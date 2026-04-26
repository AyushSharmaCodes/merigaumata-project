export type VariantUnit = 'kg' | 'gm' | 'ltr' | 'ml' | 'pcs';

export interface DeliveryConfig {
    id: string;
    product_id: string | null;
    variant_id: string | null;
    scope: 'PRODUCT' | 'VARIANT';
    calculation_type: 'PER_PACKAGE' | 'WEIGHT_BASED' | 'FLAT_PER_ORDER' | 'PER_ITEM';
    base_delivery_charge: number;
    max_items_per_package?: number;
    unit_weight?: number | null;
    gst_percentage: number;
    is_taxable: boolean;
    delivery_refund_policy: 'REFUNDABLE' | 'NON_REFUNDABLE';
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Simplified fields for product-level config
    is_delivery_available?: boolean;
    delivery_charge_type?: 'FIXED' | 'PERCENTAGE' | 'FREE';
    delivery_charge_value?: number;
    min_order_for_free_delivery?: number;
    estimated_delivery_days?: number;
    provider?: string;
    tracking_url?: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size_label: string;
  size_label_i18n?: Record<string, string>;
  size_value: number;
  unit: VariantUnit;
  description?: string;
  description_i18n?: Record<string, string>;
  mrp: number;
  selling_price: number;
  stock_quantity: number;
  variant_image_url?: string;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
  hsn_code?: string;
  gst_rate?: number;
  tax_applicable?: boolean;
  price_includes_tax?: boolean;
  delivery_config?: DeliveryConfig;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  delivery_charge?: number;
  mrp?: number;
  discount?: number;
  images: string[];
  category: string;
  category_id?: string;
  category_data?: {
    id: string;
    name: string;
    name_i18n?: Record<string, string>;
    type: string;
  };
  variant_mode?: 'UNIT' | 'SIZE';
  tags?: string[];
  en_tags?: string[];
  tags_i18n?: Record<string, string[]>;
  createdAt: string;
  rating?: number;
  ratingCount?: number;
  reviewCount?: number;
  inventory?: number;
  isNew?: boolean;
  is_new?: boolean;
  benefits?: string[];
  isReturnable?: boolean;
  is_returnable?: boolean;
  returnDays?: number;
  return_days?: number;
  variants?: ProductVariant[];
  defaultVariant?: ProductVariant;
  default_hsn_code?: string;
  default_gst_rate?: number;
  default_tax_applicable?: boolean;
  default_price_includes_tax?: boolean;
  delivery_refund_policy?: 'REFUNDABLE' | 'NON_REFUNDABLE';
  delivery_config?: DeliveryConfig;
  gst_rate?: number;
  gstRate?: number;
  price_includes_tax?: boolean;
  title_i18n?: Record<string, string>;
  description_i18n?: Record<string, string>;
  benefits_i18n?: Record<string, string[]>;
  created_at?: string;
}

export interface VariantFormData {
  id?: string;
  size_label: string;
  size_label_i18n?: Record<string, string>;
  size_label_manual?: boolean;
  size_value: number;
  unit: VariantUnit;
  description?: string;
  description_i18n?: Record<string, string>;
  mrp: number;
  selling_price: number;
  stock_quantity: number;
  variant_image_url?: string | null;
  imageFile?: File | string;
  is_default: boolean;
  hsn_code?: string;
  gst_rate?: number;
  tax_applicable?: boolean;
  price_includes_tax?: boolean;
  delivery_charge?: number | null;
  delivery_config?: Partial<DeliveryConfig>;
}
