// ─── Domain Re-exports ──────────────────────────────────────────────────────
// All types are now owned by their respective domains.
// shared/types serves as the backward-compatible barrel export.

// Auth Domain
import { User, Role, CreateUserDto, Address, AuthSession } from "@/domains/auth";
export type { User, Role, CreateUserDto, Address, AuthSession };

// Product Domain
import { Product, ProductVariant, VariantUnit, VariantFormData, DeliveryConfig } from "@/domains/product";
export type { Product, ProductVariant, VariantUnit, VariantFormData, DeliveryConfig };

// Cart Domain
import { CartItem, CartResponse, CartTotals, Coupon, CreateCouponDto } from "@/domains/cart";
export type { CartItem, CartResponse, CartTotals, Coupon, CreateCouponDto };

// Order Domain
import {
  OrderStatus, PaymentStatus, OrderItem, Order, OrderStatusHistory,
  ReturnRequestItem, ReturnableItem, ReturnRequest,
  Invoice, OrderViewState,
  CheckoutAddress, CreateAddressDto, Payment, CheckoutSummary, RazorpayOrderResponse
} from "@/domains/order";
export type {
  OrderStatus, PaymentStatus, OrderItem, Order, OrderStatusHistory,
  ReturnRequestItem, ReturnableItem, ReturnRequest,
  Invoice, OrderViewState,
  CheckoutAddress, CreateAddressDto, Payment, CheckoutSummary, RazorpayOrderResponse
};

// Content Domain
import {
  Blog, Comment, FlaggedComment,
  Event, EventRefund, EventRegistration, CancellationJobStatus,
  GalleryImage, GalleryFolder, GalleryVideo,
  Testimonial, Review, FAQ,
  AboutCard, ImpactStat, TimelineItem, TeamMember, FutureGoal,
  AboutUsSectionVisibility, AboutUsContent,
  HeroCarouselSlide, PostalCodeResult
} from "@/domains/content";
export type {
  Blog, Comment, FlaggedComment,
  Event, EventRefund, EventRegistration, CancellationJobStatus,
  GalleryImage, GalleryFolder, GalleryVideo,
  Testimonial, Review, FAQ,
  AboutCard, ImpactStat, TimelineItem, TeamMember, FutureGoal,
  AboutUsSectionVisibility, AboutUsContent,
  HeroCarouselSlide, PostalCodeResult
};

// Settings Domain
import {
  Category, CategoryType,
  ContactAddress, ContactPhone, ContactEmail, OfficeHour,
  ContactInfoData, ContactFormData, ContactResponse, ContactMessage, ContactMessagesResponse,
  SocialMediaLink, BankDetails,
  SupportedCurrency, CurrencySettings, CurrencyContextResponse,
  DeliverySettings, Policy
} from "@/domains/settings";
export type {
  Category, CategoryType,
  ContactAddress, ContactPhone, ContactEmail, OfficeHour,
  ContactInfoData, ContactFormData, ContactResponse, ContactMessage, ContactMessagesResponse,
  SocialMediaLink, BankDetails,
  SupportedCurrency, CurrencySettings, CurrencyContextResponse,
  DeliverySettings, Policy
};

// ─── Shared Generic Types ───────────────────────────────────────────────────

export interface ApiErrorResponse {
  error: string;
  status?: number;
  code?: string;
  requestId?: string;
  stack?: string;
  attemptsRemaining?: number;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

// RefundStatus re-exported from both content (EventRefund) and order domains
import { RefundStatus } from "@/domains/order";
export type { RefundStatus };
