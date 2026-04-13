declare const Deno: any;
// @ts-ignore: Deno URL imports are not recognized by the standard Node compiler
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// @ts-ignore
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const checkoutSchema = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    variant_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    price_per_unit: z.number().positive()
  })).min(1),
  subtotal: z.number().nonnegative(),
  total_amount: z.number().positive(),
  delivery_charge: z.number().default(0),
  delivery_gst: z.number().default(0),
  coupon_code: z.string().optional().nullable(),
  coupon_discount: z.number().default(0),
  shipping_address_id: z.string().uuid().optional().nullable(),
  billing_address_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. Authenticate Request
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Validate Payload
    const body = await req.json();
    const result = checkoutSchema.safeParse(body);
    if (!result.success) {
      return new Response(JSON.stringify({ error: 'Invalid payload', details: result.error.issues }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { 
      items, 
      subtotal, 
      total_amount, 
      delivery_charge, 
      delivery_gst, 
      coupon_code, 
      coupon_discount, 
      shipping_address_id, 
      billing_address_id, 
      notes 
    } = result.data;

    // 3. Execute Atomic Transaction built into Postgres RPC
    // We elevate privileges via service_role context only to bypass RLS for inserting the order securely
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: orderId, error: rpcError } = await supabaseAdmin.rpc('place_order_transaction', {
      p_user_id: user.id,
      p_items: items,
      p_subtotal: subtotal,
      p_total_amount: total_amount,
      p_delivery_charge: delivery_charge,
      p_delivery_gst: delivery_gst,
      p_coupon_code: coupon_code,
      p_coupon_discount: coupon_discount,
      p_shipping_address_id: shipping_address_id,
      p_billing_address_id: billing_address_id,
      p_notes: notes
    });

    if (rpcError) throw rpcError;

    // 4. Create Razorpay Order
    const razorpayKey = Deno.env.get('RAZORPAY_KEY_ID');
    const razorpaySecret = Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKey || !razorpaySecret) {
      throw new Error('Razorpay keys not configured');
    }

    const auth = btoa(`${razorpayKey}:${razorpaySecret}`);
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Math.round(total_amount * 100), // Razorpay expects amount in paise
        currency: 'INR',
        receipt: orderId, // Link our DB Order ID
        notes: {
          order_id: orderId,
          user_id: user.id
        }
      })
    });

    const razorpayOrder = await razorpayResponse.json();
    if (!razorpayResponse.ok) {
      console.error('Razorpay Error:', razorpayOrder);
      throw new Error('Failed to create Razorpay order');
    }

    // 5. Update Payment Record or Order with Razorpay Order ID (optional, but good for tracking)
    const { data: paymentRecord, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        order_id: orderId,
        user_id: user.id,
        razorpay_order_id: razorpayOrder.id,
        amount: total_amount,
        status: 'created'
      })
      .select('id')
      .single();

    if (paymentError) {
      console.error('Payment Record Error:', paymentError);
      // We don't throw here to avoid killing the flow if payment record fails (RP order is already created)
    }

    // Return Success
    return new Response(JSON.stringify({ 
      success: true, 
      order_id: orderId,
      razorpay_order_id: razorpayOrder.id,
      payment_id: paymentRecord?.id || null, // Return internal payment ID
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Edge Function Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
