export type Role = "customer" | "admin" | "manager";

export interface User {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  role: Role;
  addresses: Address[];
  createdBy?: string; // Admin ID who created this admin user
  emailVerified?: boolean;
  phoneVerified?: boolean;
  authProvider?: "LOCAL" | "GOOGLE";
  isActive?: boolean; // Active/Inactive status for admins
  isDeleted?: boolean; // Whether account is permanently deleted
  deletionStatus?: string;
  scheduledDeletionAt?: string;
  createdAt?: string;
  updatedAt?: string;
  mustChangePassword?: boolean;
  image?: string;
  language?: string;
}

export interface CreateUserDto extends Partial<User> {
  password?: string;
}

export interface ApiErrorResponse {
  error: string;
  status?: number;
  code?: string;
  requestId?: string;
  stack?: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

export interface Address {
  id: string;
  name: string;
  phone: string;
  pincode: string;
  locality: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  landmark?: string;
  alternatePhone?: string;
  addressType: "home" | "work" | "other" | "shipping" | "billing" | "both";
  isDefault?: boolean;
  type?: "shipping" | "billing";
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
  category_id?: string; // Foreign Key
  category_data?: {     // Joined Data
    id: string;
    name: string;
    name_i18n?: Record<string, string>;
    type: string;
  };
  variant_mode?: 'UNIT' | 'SIZE'; // Added variant_mode
  tags?: string[];
  tags_i18n?: Record<string, string[]>; // Added localized tags
  createdAt: string;
  rating?: number;
  ratingCount?: number;
  reviewCount?: number;
  inventory?: number;
  isNew?: boolean;
  benefits?: string[];
  isReturnable?: boolean;
  returnDays?: number;
  variants?: ProductVariant[];
  defaultVariant?: ProductVariant;
  // GST Default fields
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
}

export type VariantUnit = 'kg' | 'gm' | 'ltr' | 'ml' | 'pcs';

export interface ProductVariant {
  id: string;
  product_id: string;
  size_label: string;
  size_label_i18n?: Record<string, string>;
  size_value: number;
  unit: VariantUnit;
  description?: string; // Added description
  description_i18n?: Record<string, string>; // Added localized description
  mrp: number;
  selling_price: number;
  stock_quantity: number;
  variant_image_url?: string;
  is_default: boolean;
  created_at: string;
  updated_at?: string;
  // GST fields
  hsn_code?: string;
  gst_rate?: number;
  tax_applicable?: boolean;
  price_includes_tax?: boolean;
  delivery_config?: DeliveryConfig;
}

export interface VariantFormData {
  id?: string;
  size_label: string;
  size_label_i18n?: Record<string, string>;
  size_value: number;
  unit: VariantUnit;
  description?: string; // Added description
  description_i18n?: Record<string, string>; // Added localized description
  mrp: number;
  selling_price: number;
  stock_quantity: number;
  variant_image_url?: string | null;
  imageFile?: File | string;
  is_default: boolean;
  // GST fields
  hsn_code?: string;
  gst_rate?: number;
  tax_applicable?: boolean;
  price_includes_tax?: boolean;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  location: { lat?: number; lng?: number; address?: string };
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  capacity?: number;
  image?: string;
  registrations?: number;
  registrationAmount?: number;
  category?: string; // Dynamic category from admin (internal use only)
  kathaVachak?: string;
  contactAddress?: string;
  isRegistrationEnabled?: boolean;
  keyHighlights?: string[];
  specialPrivileges?: string[];
  gstRate?: number;
  basePrice?: number;
  gstAmount?: number;
  registrationDeadline?: string;
  cancellationStatus?: "CANCELLATION_PENDING" | "CANCELLED" | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  cancellationCorrelationId?: string | null;
  title_i18n?: Record<string, string>;
  description_i18n?: Record<string, string>;
  keyHighlights_i18n?: Record<string, string[]>;
  specialPrivileges_i18n?: Record<string, string[]>;
  category_data?: {
    id: string;
    name: string;
    name_i18n?: Record<string, string>;
    type: string;
  };
}

export interface Blog {
  id: string;
  title: string;
  title_i18n?: Record<string, string>;
  content: string;
  content_i18n?: Record<string, string>;
  excerpt: string;
  excerpt_i18n?: Record<string, string>;
  author: string;
  author_i18n?: Record<string, string>;
  date: string;
  image?: string;
  tags?: string[];
  tags_i18n?: Record<string, string[]>;
  published?: boolean;
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

export type OrderStatus =
  // Normal Flow
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  // Cancellation & Refund
  | "cancelled"
  | "refunded"
  // Return Flow
  | "return_requested"
  | "return_approved"
  | "return_picked_up"
  | "return_rejected"
  | "returned"
  | "partially_returned"
  | "partially_refunded"
  | "delivery_unsuccessful";


export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_per_unit: number;
  title: string;
  image?: string;
  product?: Product;
}

export interface ReturnRequest {
  id: string;
  order_id: string;
  user_id: string;
  status: 'requested' | 'approved' | 'rejected' | 'picked_up' | 'received' | 'refunded';
  reason: string;
  refund_amount: number;
  created_at: string;
  updated_at: string;
  return_items?: Array<{
    id: string;
    product_id: string;
    quantity: number;
    product?: Product;
    order_items?: {
      title: string;
      price_per_unit: number;
    };
  }>;
}

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

export interface Order {
  id: string;
  user_id: string;
  userId?: string; // Alias for user_id
  order_number?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  items: CartItem[] | OrderItem[];
  total_amount: number;
  total?: number;
  status: OrderStatus;
  shipping_address: Address;
  shippingAddress?: Address; // Alias for shipping_address
  billing_address?: Address;
  billingAddress?: Address; // Alias for billing_address
  payment_status: "pending" | "paid" | "failed" | "refunded" | "partially_refunded" | "refund_initiated";
  paymentStatus?: "pending" | "paid" | "failed" | "refunded" | "partially_refunded" | "refund_initiated"; // Alias
  created_at: string;
  createdAt?: string; // Alias for created_at
  updated_at?: string;
  updatedAt?: string; // Alias for updated_at
  invoice_url?: string;
  invoices?: Invoice[];
  coupon_discount?: number;
  // Cancel/Return request details
  cancel_reason?: string;
  cancelReason?: string; // Alias
  cancel_comments?: string;
  cancelComments?: string; // Alias
  cancel_requested_at?: string;
  cancelRequestedAt?: string; // Alias
  return_reason?: string;
  returnReason?: string; // Alias
  return_issue?: string;
  returnIssue?: string; // Alias
  return_images?: string[];
  returnImages?: string[]; // Alias
  return_requested_at?: string;
  returnRequestedAt?: string; // Alias
}

export interface GalleryImage {
  id: string;
  url: string;
  title?: string;
  description?: string;
}

export interface GalleryFolder {
  id: string;
  title: string;
  description?: string;
  images: string[]; // Array of image URLs
  createdAt: string;
}

export interface GalleryVideo {
  id: string;
  youtubeId: string;
  title?: string;
  description?: string;
}

export interface Review {
  id: string;
  productId: string;
  productName?: string; // Added for admin view
  productImage?: string; // Added for admin view
  userId?: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
  verified?: boolean;
}

export interface Comment {
  id: string;
  blogId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  parentId?: string;
  isDeleted?: boolean;
  isFlagged?: boolean;
  flagReason?: string;
  flaggedBy?: string;
  flaggedAt?: string;
}

export interface PostalCodeResult {
  isValid: boolean;
  city: string;
  state: string;
  country: string;
  locality: string;
}

export interface FlaggedComment extends Comment {
  blogTitle: string;
  userAvatar?: string;
  userBlocked?: boolean;
}

export interface Testimonial {
  id: string;
  name: string;
  role?: string;
  content: string;
  rating: number;
  image?: string;
  createdAt?: string;
  created_at?: string;
  approved?: boolean;
  name_i18n?: Record<string, string>;
  role_i18n?: Record<string, string>;
  content_i18n?: Record<string, string>;
}

export interface FAQ {
  id: string;
  question: string;
  question_i18n?: Record<string, string>;
  answer: string;
  answer_i18n?: Record<string, string>;
  category: string;
  order?: number;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AboutCard {
  id: string;
  title: string;
  title_i18n?: Record<string, string>;
  description: string;
  description_i18n?: Record<string, string>;
  icon: string;
  order: number;
}

export interface ImpactStat {
  id: string;
  value: string;
  label: string;
  label_i18n?: Record<string, string>;
  icon: string;
  order: number;
}

export interface TimelineItem {
  id: string;
  month: string;
  year: string;
  title: string;
  title_i18n?: Record<string, string>;
  description: string;
  description_i18n?: Record<string, string>;
  order: number;
}

export interface TeamMember {
  id: string;
  name: string;
  name_i18n?: Record<string, string>;
  role: string;
  role_i18n?: Record<string, string>;
  image: string;
  bio: string;
  bio_i18n?: Record<string, string>;
  order: number;
}

export interface FutureGoal {
  id: string;
  title: string;
  title_i18n?: Record<string, string>;
  description: string;
  description_i18n?: Record<string, string>;
  order: number;
}

export interface HeroCarouselSlide {
  id: string;
  image: string;
  title?: string;
  title_i18n?: Record<string, string>;
  subtitle?: string;
  subtitle_i18n?: Record<string, string>;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AboutUsSectionVisibility {
  missionVision: boolean;
  impactStats: boolean;
  ourStory: boolean;
  team: boolean;
  futureGoals: boolean;
  callToAction: boolean;
}

export interface AboutUsContent {
  cards: AboutCard[];
  impactStats: ImpactStat[];
  timeline: TimelineItem[];
  teamMembers: TeamMember[];
  futureGoals: FutureGoal[];
  footerDescription: string;
  footerDescription_i18n?: Record<string, string>;
  sectionVisibility: AboutUsSectionVisibility;
}

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
  // Backend snake_case fields
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
  deliverySettings?: {
    threshold: number;
    charge: number;
    gst: number;
  };
}

export interface DeliverySettings {
  delivery_threshold: number;
  delivery_charge: number;
}

// Checkout & Payment Types
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
  totals: CartTotals;
  shipping_address?: CheckoutAddress;
  billing_address?: CheckoutAddress;
  razorpay_key_id?: string; // PHASE 2B: Razorpay key for optimization
  user_profile?: any; // PHASE 3A: User profile for optimization
}

export interface RazorpayOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  payment_id: string;
  key_id: string;
}

export type RefundStatus = 'NOT_APPLICABLE' | 'INITIATED' | 'PROCESSING' | 'SETTLED' | 'FAILED' | 'REVERSED';

export interface EventRefund {
  id: string;
  event_id: string;
  registration_id: string;
  payment_id: string;
  amount: number;
  status: RefundStatus;
  gateway_reference?: string;
  initiated_at?: string;
  settled_at?: string;
  failed_at?: string;
  failure_reason?: string;
  correlation_id: string;
}

export interface EventRegistration {
  id: string;
  registration_number: string;
  event_id: string;
  user_id?: string;
  full_name: string;
  email: string;
  phone: string;
  amount: number;
  gst_rate?: number;
  base_price?: number;
  gst_amount?: number;
  payment_status: string;
  status: "pending" | "confirmed" | "cancelled" | "refunded";
  created_at: string;
  updated_at: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  events?: Event;
  refunds?: EventRefund[];
}

export interface CancellationJobStatus {
  id: string;
  event_id: string;
  correlation_id: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "PARTIAL_FAILURE";
  total_registrations: number;
  processed_count: number;
  failed_count: number;
  batch_size: number;
  last_processed_at?: string;
  completed_at?: string;
}

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
}
