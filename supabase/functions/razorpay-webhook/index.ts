declare const Deno: any;
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get('x-razorpay-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const rawBody = await req.text();
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Verify Signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(rawBody)
    );
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (signature !== expectedSignature) {
      console.warn('Invalid signature detected');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Parse Event
    const event = JSON.parse(rawBody);
    console.log(`Processing Razorpay Webhook Event: ${event.event}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Log Webhook Event (Idempotency Audit Trail)
    const { data: logEntry, error: logError } = await supabaseAdmin
      .from('webhook_logs')
      .insert({
        provider: 'razorpay',
        event_type: event.event,
        payload: event.payload,
        signature_verified: true,
        processed: false,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (logError) {
      console.error('Failed to log webhook:', logError);
    }

    const payment = event.payload.payment?.entity;
    const subscription = event.payload.subscription?.entity;
    const notes = payment?.notes || event.payload.payment?.entity?.notes || {};
    
    // 4. Handle Specific Events
    
    // CASE A: E-Commerce ORDER
    if (event === 'payment.captured' && payment && !notes.payment_purpose && !notes.eventId) {
      const razorpayOrderId = payment.order_id;
      
      const { data: dbPayment, error: paymentError } = await supabaseAdmin
        .from('payments')
        .update({
          status: 'captured',
          razorpay_payment_id: payment.id,
          method: payment.method,
          updated_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', razorpayOrderId)
        .select('id, order_id')
        .maybeSingle();

      if (dbPayment?.order_id) {
        await supabaseAdmin.from('orders').update({ payment_status: 'paid', status: 'pending', updated_at: new Date().toISOString() }).eq('id', dbPayment.order_id);
        await supabaseAdmin.from('invoices').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('order_id', dbPayment.order_id).eq('type', 'RAZORPAY');
        console.log(`Order ${dbPayment.order_id} marked as PAID via Webhook`);
      }
    } 
    
    // CASE B: DONATION (One-Time)
    else if (event === 'payment.captured' && notes.payment_purpose === 'DONATION' && !subscription) {
      await supabaseAdmin
        .from('donations')
        .update({
          payment_status: 'success',
          razorpay_payment_id: payment.id,
          updated_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', payment.order_id);
      console.log(`One-time Donation ${payment.order_id} marked as SUCCESS`);
    }

    // CASE C: EVENT REGISTRATION
    else if (event === 'payment.captured' && notes.eventId) {
      await supabaseAdmin
        .from('event_registrations')
        .update({
          payment_status: 'paid',
          razorpay_payment_id: payment.id,
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('razorpay_order_id', payment.order_id);
      console.log(`Event Registration ${payment.order_id} marked as CONFIRMED`);
    }

    // CASE D: SUBSCRIPTION (Recurring Donation)
    else if (event === 'subscription.charged' && subscription) {
      // Create a new donation record for the recurring charge
      const amount = payment.amount / 100;
      await supabaseAdmin.from('donations').insert([{
        type: 'monthly',
        amount: amount,
        razorpay_payment_id: payment.id,
        razorpay_subscription_id: subscription.id,
        payment_status: 'success',
        created_at: new Date().toISOString()
      }]);
      
      // Update subscription info
      await supabaseAdmin.from('donation_subscriptions').update({
        status: subscription.status,
        next_billing_at: subscription.charge_at ? new Date(subscription.charge_at * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      }).eq('razorpay_subscription_id', subscription.id);
      
      console.log(`Recurring Donation for Sub ${subscription.id} processed`);
    }

    // CASE E: PAYMENT FAILURE
    else if (event === 'payment.failed' && payment) {
      // Update standard payments table
      await supabaseAdmin.from('payments').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('razorpay_order_id', payment.order_id);
      // Update donations table (if applicable)
      await supabaseAdmin.from('donations').update({ payment_status: 'failed', updated_at: new Date().toISOString() }).eq('razorpay_order_id', payment.order_id);
    }

    // Mark as processed
    if (logEntry) {
      await supabaseAdmin
        .from('webhook_logs')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', logEntry.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Webhook Edge Function Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
