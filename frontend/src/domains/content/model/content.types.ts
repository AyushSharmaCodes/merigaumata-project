// ─── Blog ───────────────────────────────────────────────────────────────────

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

export interface FlaggedComment extends Comment {
  blogTitle: string;
  userAvatar?: string;
  userBlocked?: boolean;
}

// ─── Event ──────────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  title: string;
  description: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  scheduleType?: "single_day" | "multi_day_daily" | "multi_day_continuous";
  location: { lat?: number; lng?: number; address?: string };
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  capacity?: number;
  image?: string;
  registrations?: number;
  registrationAmount?: number;
  category?: string;
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

// ─── Gallery ────────────────────────────────────────────────────────────────

export interface GalleryImage {
  id: string;
  url: string;
  title?: string;
  description?: string;
}

export interface GalleryFolder {
  id: string;
  name: string;
  name_i18n?: Record<string, string>;
  description?: string;
  description_i18n?: Record<string, string>;
  slug: string;
  category_id: string;
  category_name?: string;
  cover_image?: string;
  order_index: number;
  is_active: boolean;
  is_hidden?: boolean;
  is_home_carousel?: boolean;
  is_mobile_carousel?: boolean;
  created_at: string;
  updated_at: string;
  gallery_items?: {
    image_url: string;
    thumbnail_url: string;
  }[];
  // Legacy aliases
  title?: string;
  images?: string[];
  createdAt?: string;
}

export interface GalleryVideo {
  id: string;
  folder_id?: string;
  title?: string;
  title_i18n?: Record<string, string>;
  description?: string;
  description_i18n?: Record<string, string>;
  youtube_url?: string;
  youtube_id?: string;
  youtubeId?: string;
  thumbnail_url?: string;
  order_index?: number;
  duration?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

// ─── Testimonial ────────────────────────────────────────────────────────────

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

// ─── Review ─────────────────────────────────────────────────────────────────

export interface Review {
  id: string;
  productId: string;
  productName?: string;
  productImage?: string;
  userId?: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  comment: string;
  createdAt: string;
  verified?: boolean;
}

// ─── FAQ ────────────────────────────────────────────────────────────────────

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

// ─── About Us ───────────────────────────────────────────────────────────────

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

// ─── Hero Carousel ──────────────────────────────────────────────────────────

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

// ─── Misc ───────────────────────────────────────────────────────────────────

export interface PostalCodeResult {
  isValid: boolean;
  city: string;
  state: string;
  country: string;
  locality: string;
}
