import { 
    CreditCard, 
    Clock, 
    Package, 
    MapPin, 
    Settings, 
    MessageSquare, 
    User, 
    Pencil 
} from "lucide-react";
import React from "react";

export interface CancellationReason {
    key: string;
    label: string;
}

export interface ReasonsCategory {
    category: string;
    icon?: React.ComponentType<{ className?: string }>;
    reasons: CancellationReason[];
}

export const CUSTOMER_CANCELLATION_REASONS: ReasonsCategory[] = [
    {
        category: "Price & Payment Concerns",
        icon: CreditCard,
        reasons: [
            { key: "better_price", label: "Found a better price elsewhere" },
            { key: "high_shipping", label: "Shipping charges too high" },
            { key: "cost_too_high", label: "Total cost higher than expected" },
            { key: "payment_issue", label: "Payment issues / unable to complete payment" },
            { key: "wrong_coupon", label: "Applied wrong coupon / want to reorder" },
        ],
    },
    {
        category: "Delivery & Timing Issues",
        icon: Clock,
        reasons: [
            { key: "long_delivery", label: "Delivery time too long" },
            { key: "urgent_need", label: "Need the product urgently (won’t arrive in time)" },
            { key: "wrong_date", label: "Wrong delivery date selected" },
        ],
    },
    {
        category: "Product-Related Concerns",
        icon: Package,
        reasons: [
            { key: "ordered_by_mistake", label: "Ordered by mistake" },
            { key: "changed_mind", label: "Changed my mind" },
            { key: "wrong_variant", label: "Ordered wrong product/variant (size, color, quantity)" },
            { key: "details_unsatisfactory", label: "Product details not satisfactory" },
            { key: "better_alternative", label: "Found better alternative product" },
        ],
    },
    {
        category: "Address & Location Issues",
        icon: MapPin,
        reasons: [
            { key: "wrong_address", label: "Wrong delivery address entered" },
            { key: "change_location", label: "Need to change delivery location" },
        ],
    },
    {
        category: "Order Management Issues",
        icon: Settings,
        reasons: [
            { key: "duplicate_order", label: "Duplicate order placed" },
            { key: "modify_instead", label: "Want to modify order (instead of cancel)" },
        ],
    },
    {
        category: "Support & Experience Issues",
        icon: MessageSquare,
        reasons: [
            { key: "poor_support", label: "Poor customer support experience" },
            { key: "tech_issue", label: "App/website issue during checkout" },
        ],
    },
    {
        category: "Personal Reasons",
        icon: User,
        reasons: [
            { key: "not_needed", label: "No longer needed" },
            { key: "budget_constraints", label: "Financial constraints / budget issues" },
            { key: "for_someone_else", label: "Ordered for someone else, no longer required" },
        ],
    },
    {
        category: "Other",
        icon: Pencil,
        reasons: [
            { key: "other", label: "Other (please specify)" },
        ],
    },
];
