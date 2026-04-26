import { 
    Calendar, 
    FlaskConical, 
    Package, 
    ClipboardCheck, 
    Sprout, 
    ShieldAlert, 
    Image, 
    Droplets, 
    Truck, 
    XCircle,
    Pencil
} from "lucide-react";
import React from "react";

export interface RejectionReason {
    key: string;
    label: string;
}

export interface RejectionCategory {
    category: string;
    icon?: React.ComponentType<{ className?: string }>;
    reasons: RejectionReason[];
}

export const RETURN_REJECTION_REASONS: RejectionCategory[] = [
    {
        category: "Policy & Eligibility",
        icon: Calendar,
        reasons: [
            { key: "policy_time_window_exceeded", label: "Return request raised after allowed time window" },
            { key: "policy_non_returnable_category", label: "Product marked as non-returnable (consumable category)" },
            { key: "policy_non_returnable_offer", label: "Purchased under non-returnable offer/discount" },
        ],
    },
    {
        category: "Usage / Hygiene Restrictions",
        icon: FlaskConical,
        reasons: [
            { key: "usage_product_opened", label: "Product already opened (non-returnable item)" },
            { key: "usage_consumed", label: "Product partially or fully used/consumed" },
            { key: "usage_hygiene_opened", label: "Hygiene-sensitive item not eligible after opening" },
            { key: "usage_contaminated", label: "Product contaminated after delivery" },
        ],
    },
    {
        category: "Packaging & Condition",
        icon: Package,
        reasons: [
            { key: "condition_no_packaging", label: "Original packaging not available" },
            { key: "condition_seal_broken", label: "Seal broken by customer (where required intact)" },
            { key: "condition_not_original", label: "Product not returned in original condition" },
        ],
    },
    {
        category: "Quality Check Failure",
        icon: ClipboardCheck,
        reasons: [
            { key: "qc_no_defect", label: "No defect found during inspection" },
            { key: "qc_within_standards", label: "Product quality within acceptable standards" },
            { key: "qc_matches_description", label: "Product matches description provided" },
        ],
    },
    {
        category: "Natural Variations (Non-Defect)",
        icon: Sprout,
        reasons: [
            { key: "natural_smell", label: "Smell is natural and expected (not a defect)" },
            { key: "natural_color", label: "Color variation is natural" },
            { key: "natural_texture", label: "Texture/consistency variation is normal (e.g., ghee grainy)" },
        ],
    },
    {
        category: "Incorrect / Fraudulent Return",
        icon: ShieldAlert,
        reasons: [
            { key: "fraud_different_product", label: "Different product returned" },
            { key: "fraud_tampered", label: "Item tampered intentionally" },
            { key: "fraud_false_claim", label: "False claim (issue not matching evidence)" },
            { key: "fraud_suspicious_pattern", label: "Suspicious return pattern detected" },
        ],
    },
    {
        category: "Proof & Verification Issues",
        icon: Image,
        reasons: [
            { key: "proof_missing", label: "No valid photo/video proof provided" },
            { key: "proof_mismatch", label: "Submitted proof does not match issue claimed" },
        ],
    },
    {
        category: "Customer-Side Handling",
        icon: Droplets,
        reasons: [
            { key: "handling_improper_storage", label: "Damage due to improper storage (heat, sunlight, moisture)" },
            { key: "handling_mishandled", label: "Product mishandled after delivery" },
        ],
    },
    {
        category: "Pickup / Logistics Failure",
        icon: Truck,
        reasons: [
            { key: "logistics_customer_unavailable", label: "Customer unavailable for return pickup" },
            { key: "logistics_pickup_failed", label: "Multiple pickup attempts failed" },
            { key: "logistics_incorrect_details", label: "Incorrect pickup details provided" },
        ],
    },
    {
        category: "Reason Not Valid",
        icon: XCircle,
        reasons: [
            { key: "invalid_not_covered", label: "Return reason not covered under policy" },
            { key: "invalid_dissatisfaction", label: "Customer dissatisfaction without valid defect" },
        ],
    },
    {
        category: "Other",
        icon: Pencil,
        reasons: [
            { key: "other", label: "Other (with remarks)" },
        ],
    }
];
