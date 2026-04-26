import { Product, ProductVariant } from "@/domains/product";

export interface Coupon {
  id: string;
  code: string;
  type: 'product' | 'category' | 'cart' | 'variant' | 'free_delivery';
  discount_percentage: number;
  target_id?: string;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  valid_from: string;
  valid_until: string;
  usage_limit?: number;
  usage_count: number;
  is_active: boolean;
  target_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCouponDto {
  code: string;
  type: 'product' | 'category' | 'cart' | 'variant' | 'free_delivery';
  discount_percentage: number;
  target_id?: string;
  min_purchase_amount?: number;
  max_discount_amount?: number;
  valid_from?: string;
  valid_until: string;
  usage_limit?: number;
  is_active?: boolean;
}

export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  product: Product;
  variant?: ProductVariant;
  sizeLabel?: string;
  delivery_charge?: number;
  delivery_gst?: number;
  delivery_meta?: any;
  coupon_discount?: number;
  coupon_code?: string;
  tax_breakdown?: {
    taxable_amount?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    total_tax?: number;
    total_amount?: number;
    gst_rate?: number;
    tax_type?: string | null;
  };
}

export interface CartTotals {
  itemsCount: number;
  totalMrp: number;
  totalPrice: number;
  discount: number;
  couponDiscount: number;
  deliveryCharge: number;
  deliveryGST?: number;
  finalAmount: number;
  coupon?: Coupon | null;
  productDeliveryCharges?: number;
  globalDeliveryCharge?: number;
  productDeliveryGST?: number;
  globalDeliveryGST?: number;
  global_delivery_charge?: number;
  global_delivery_gst?: number;
  product_delivery_charges?: number;
  product_delivery_gst?: number;
  itemBreakdown?: Array<{
    product_id: string;
    variant_id?: string;
    quantity?: number;
    mrp?: number;
    price?: number;
    discounted_price?: number;
    coupon_discount?: number;
    coupon_code?: string;
    delivery_charge?: number;
    delivery_gst?: number;
    delivery_meta?: any;
    tax_breakdown?: CartItem["tax_breakdown"];
  }>;
  tax?: {
    totalTaxableAmount: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
    taxType: 'INTRA' | 'INTER' | null;
    isInterState: boolean;
  };
}

export interface CartResponse {
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
  totals: CartTotals;
}
