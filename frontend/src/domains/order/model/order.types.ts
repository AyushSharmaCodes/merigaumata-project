import { Product, ProductVariant } from "@/domains/product";
import { Address } from "@/domains/auth";

// ─── Order Status ───────────────────────────────────────────────────────────

export type OrderStatus =
  // Normal Flow
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "delivery_reattempt_scheduled"
  | "rto_in_transit"
  | "returned_to_origin"
  // Cancellation & Refund
  | "cancelled"
  | "cancelled_by_admin"
  | "cancelled_by_customer"
  | "refunded"
  // Return Flow
  | "return_requested"
  | "return_approved"
  | "return_picked_up"
  | "return_rejected"
  | "returned"
  | "partially_returned"
  | "partial_refunded"
  | "partially_refunded"
  | "delivery_unsuccessful"
  | "pickup_scheduled"
  | "pickup_attempted"
  | "pickup_completed"
  | "picked_up"
  | "in_transit_to_warehouse"
  | "qc_initiated"
  | "qc_passed"
  | "qc_failed"
  | "partial_refund"
  | "zero_refund"
  | "return_back_to_customer"
  | "dispose_liquidate";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "refund_initiated";

// ─── Order Item ─────────────────────────────────────────────────────────────

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_per_unit: number;
  title: string;
  image?: string;
  product?: Product;
  // Admin Snapshot Fields
  variant_id?: string;
  variant?: any;
  variant_snapshot?: any;
  size_label?: string;
  is_returnable?: boolean;
  returned_quantity?: number;
  hsn_code?: string;
  gst_rate?: number;
  taxable_amount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  delivery_charge?: number;
  delivery_gst?: number;
  product_snapshot?: {
    main_image?: string;
    [key: string]: any;
  };
  delivery_calculation_snapshot?: any;
}

// ─── Returns ────────────────────────────────────────────────────────────────

export interface ReturnRequestItem {
  id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  reason: string;
  images?: string[];
  condition?: string;
  status:
    | 'requested'
    | 'approved'
    | 'picked_up'
    | 'item_returned'
    | 'qc_initiated'
    | 'qc_passed'
    | 'qc_failed'
    | 'return_to_customer'
    | 'dispose_liquidate';
  order_item_id: string;
  order_items?: OrderItem | OrderItem[];
}

export interface ReturnableItem {
  id: string;
  title: string;
  price_per_unit: number;
  remaining_quantity: number;
  return_days?: number;
  return_deadline?: string;
  variant_snapshot?: {
    size_label?: string;
    variant_image_url?: string;
    [key: string]: unknown;
  };
  variant?: {
    variant_image_url?: string;
    [key: string]: unknown;
  };
  product?: {
    images?: string[];
    main_image?: string;
    [key: string]: unknown;
  };
  product_snapshot?: {
    main_image?: string;
    [key: string]: unknown;
  };
  image_url?: string;
}

export interface ReturnRequest {
  id: string;
  user_id: string;
  status:
    | 'requested'
    | 'approved'
    | 'pickup_scheduled'
    | 'pickup_attempted'
    | 'pickup_completed'
    | 'picked_up'
    | 'item_returned'
    | 'qc_initiated'
    | 'qc_passed'
    | 'qc_failed'
    | 'partial_refund'
    | 'zero_refund'
    | 'return_to_customer'
    | 'dispose_liquidate'
    | 'rejected'
    | 'cancelled'
    | 'completed';
  reason: string;
  refund_amount: number;
  created_at: string;
  updated_at: string;
  staff_notes?: string;
  refund_breakdown?: any;
  return_items: ReturnRequestItem[];
}

// ─── Order History ──────────────────────────────────────────────────────────

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: string;
  event_type?: string;
  actor?: string;
  created_at: string;
  updated_by: string;
  return_id?: string | null;
  notes?: string;
  updater?: {
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    role_data?: {
      name: string;
    };
  };
}

// ─── Invoice ────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  order_id: string;
  type: 'RAZORPAY' | 'TAX_INVOICE' | 'BILL_OF_SUPPLY';
  invoice_number: string;
  provider_id?: string;
  public_url?: string;
  status: 'PENDING' | 'GENERATED' | 'FAILED';
  created_at: string;
}

// ─── Order View State ───────────────────────────────────────────────────────

export interface OrderViewState {
  actions: {
    can_cancel_order: boolean;
    can_request_return: boolean;
    can_cancel_latest_return: boolean;
    admin?: {
      can_manage_invoice: boolean;
      can_generate_invoice: boolean;
      can_regenerate_invoice: boolean;
      can_cancel_order: boolean;
      available_status_transitions: string[];
      active_return_request_id?: string | null;
      can_approve_active_return: boolean;
      can_reject_active_return: boolean;
      can_mark_active_return_picked_up: boolean;
    };
  };
  documents: {
    can_download_receipt: boolean;
    receipt_invoice_id?: string | null;
    receipt_url?: string | null;
    can_download_invoice: boolean;
    invoice_id?: string | null;
    invoice_url?: string | null;
  };
  returns: {
    can_request_return: boolean;
    returnable_item_count: number;
    returnable_quantity_count: number;
    has_return_requests: boolean;
    latest_return_request_id?: string | null;
    latest_return_status?: string | null;
    can_cancel_latest_return: boolean;
  };
  lifecycle: {
    current_status: string;
    current_flow: 'normal' | 'cancellation' | 'delivery_recovery' | 'return';
    active_return_request_id?: string | null;
    active_return_status?: string | null;
    is_terminal: boolean;
  };
  sync?: {
    requires_high_frequency_polling: boolean;
    poll_interval_ms: number;
  };
}

// ─── Order (Full) ───────────────────────────────────────────────────────────

export interface Order {
  id: string;
  user_id: string;
  userId?: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  items: OrderItem[];
  total_amount: number;
  subtotal: number;
  coupon_discount: number;
  delivery_charge: number;
  delivery_gst?: number;
  total?: number;
  status: OrderStatus;
  shipping_address: Address;
  shippingAddress?: Address;
  billing_address?: Address;
  billingAddress?: Address;
  payment_status: PaymentStatus;
  paymentStatus?: PaymentStatus;
  payment_method: string;
  payment_id?: string;
  invoice_id?: string;
  invoice_url?: string;
  invoices?: Invoice[];
  created_at: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  order_status_history: OrderStatusHistory[];
  status_history?: OrderStatusHistory[];
  return_requests: ReturnRequest[];
  email_logs?: any[];
  refunds?: any[];
  cancel_reason?: string;
  cancelReason?: string;
  cancel_comments?: string;
  cancelComments?: string;
  cancel_requested_at?: string;
  cancelRequestedAt?: string;
  return_reason?: string;
  returnReason?: string;
  return_issue?: string;
  returnIssue?: string;
  return_images?: string[];
  returnImages?: string[];
  return_requested_at?: string;
  returnRequestedAt?: string;
  view_state?: OrderViewState;
}

// ─── Checkout & Payment ─────────────────────────────────────────────────────

export interface CheckoutAddress {
  id: string;
  user_id: string;
  type: 'home' | 'work' | 'other' | 'shipping' | 'billing' | 'both';
  is_primary: boolean;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  alternatePhone?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressDto {
  type: 'home' | 'work' | 'other' | 'shipping' | 'billing' | 'both';
  is_primary?: boolean;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
}

export interface Payment {
  id: string;
  order_id?: string;
  user_id: string;
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
  method?: string;
  error_code?: string;
  error_description?: string;
  created_at: string;
  updated_at: string;
}

export interface CheckoutSummary {
  cart: {
    id: string;
    user_id: string;
    applied_coupon_code?: string;
    cart_items: Array<{
      id: string;
      product_id: string;
      variant_id?: string;
      quantity: number;
      added_at: string;
      products: Product;
      product_variants?: ProductVariant;
    }>;
  };
  totals: any; // CartTotals — avoiding circular import
  shipping_address?: CheckoutAddress;
  billing_address?: CheckoutAddress;
  razorpay_key_id?: string;
  user_profile?: any;
}

export interface RazorpayOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  payment_id: string;
  key_id: string;
}

export interface CheckoutStockIssue {
  productId: string;
  variantId: string | null;
  title: string;
  variantLabel: string | null;
  requestedQty: number;
  availableStock: number;
  image: string | null;
}

export interface CheckoutStockValidationResponse {
  valid: boolean;
  items: CheckoutStockIssue[];
}

export interface BuyNowCheckoutInput {
  productId: string;
  variantId?: string;
  quantity: number;
  couponCode?: string;
  addressId?: string;
}

export interface CheckoutPaymentOrderRequest {
  amount: number;
  user_profile: unknown;
  address_id?: string;
}

export interface CheckoutPaymentVerificationRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  payment_id: string;
  shipping_address_id: string;
  billing_address_id: string;
  notes?: string;
}

export interface BuyNowCheckoutPaymentVerificationRequest extends CheckoutPaymentVerificationRequest {
  buyNowData: BuyNowCheckoutInput;
}

export type RefundStatus = 'NOT_APPLICABLE' | 'INITIATED' | 'PROCESSING' | 'SETTLED' | 'FAILED' | 'REVERSED';
