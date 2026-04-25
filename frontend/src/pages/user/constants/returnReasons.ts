import React from "react";
import { 
    Droplets, 
    Package, 
    FileSearch, 
    HelpCircle, 
    Truck, 
    Leaf, 
    Wallet, 
    RefreshCcw, 
    User, 
    ShieldAlert, 
    MoreHorizontal,
    Sparkles,
    AlertCircle,
    ShoppingBag,
    PackageSearch,
    Ban
} from "lucide-react";

export interface ReturnReason {
    key: string;
    label: string;
}

export interface ReturnReasonCategory {
    category: string;
    icon: React.ReactNode;
    reasons: ReturnReason[];
}

export const RETURN_REASONS: ReturnReasonCategory[] = [
    {
        category: "Quality & Product Condition",
        icon: React.createElement(Droplets, { className: "w-5 h-5 text-emerald-600" }),
        reasons: [
            { key: "product_spoiled", label: "Product spoiled / bad smell" },
            { key: "leakage_damaged", label: "Leakage or damaged packaging" },
            { key: "expired", label: "Product expired or near expiry" },
            { key: "impurities", label: "Impurities found in product" },
            { key: "texture_issue", label: "Texture/consistency not as expected (e.g., ghee crystallized)" },
        ],
    },
    {
        category: "Packaging Issues",
        icon: React.createElement(Package, { className: "w-5 h-5 text-emerald-600" }),
        reasons: [
            { key: "bottle_broken", label: "Bottle/container broken or cracked" },
            { key: "seal_tampered", label: "Seal already opened or tampered" },
            { key: "poor_packaging", label: "Poor packaging quality" },
        ],
    },
    {
        category: "Wrong or Missing Item",
        icon: React.createElement(PackageSearch, { className: "w-5 h-5 text-emerald-600" }),
        reasons: [
            { key: "wrong_product", label: "Wrong product delivered" },
            { key: "wrong_variant", label: "Wrong variant/size/quantity" },
            { key: "missing_item", label: "Missing item(s) in package" },
        ],
    },
    {
        category: "Expectation Mismatch",
        icon: React.createElement(HelpCircle, { className: "w-5 h-5 text-emerald-600" }),
        reasons: [
            { key: "not_as_described", label: "Product not as described" },
            { key: "quality_not_expected", label: "Quality not as expected" },
            { key: "color_different", label: "Color/appearance different (common for natural products)" },
            { key: "smell_unpleasant", label: "Smell too strong/unpleasant (especially for gomutra/dung products)" },
        ],
    },
    {
        category: "Delivery-Related Issues",
        icon: React.createElement(Truck, { className: "w-5 h-5 text-emerald-600" }),
        reasons: [
            { key: "delivered_late", label: "Delivered too late (no longer needed)" },
            { key: "package_mishandled", label: "Package mishandled during delivery" },
        ],
    },
    {
        category: "Usage & Effectiveness",
        icon: React.createElement(Leaf, { className: "w-5 h-5 text-emerald-600" }),
        reasons: [
            { key: "no_results", label: "Did not get expected results" },
            { key: "not_suitable", label: "Product not suitable for intended use" },
            { key: "caused_irritation", label: "Caused irritation/allergy (for personal use items)" },
        ],
    },
    {
        category: "Price & Value Concerns",
        icon: React.createElement(Wallet, { className: "w-5 h-5 text-emerald-600" }),
        reasons: [
            { key: "not_worth_price", label: "Not worth the price" },
            { key: "cheaper_alternative", label: "Found cheaper alternative" },
        ],
    },
    {
        category: "Order Mistakes",
        icon: React.createElement(RefreshCcw, { className: "w-5 h-5 text-emerald-600" }),
        reasons: [
            { key: "ordered_mistake", label: "Ordered by mistake" },
            { key: "ordered_wrong_variant", label: "Ordered wrong product/variant" },
        ],
    },
    {
        category: "Personal Reasons",
        icon: React.createElement(User, { className: "w-5 h-5 text-emerald-600" }),
        reasons: [
            { key: "no_longer_needed", label: "No longer needed" },
            { key: "changed_mind", label: "Changed mind" },
        ],
    },
    {
        category: "Trust & Authenticity",
        icon: React.createElement(ShieldAlert, { className: "w-5 h-5 text-emerald-600" }),
        reasons: [
            { key: "doubt_authenticity", label: "Doubt about purity/authenticity (important for cow-based products)" },
            { key: "lack_certification", label: "Lack of proper certification/labeling" },
        ],
    },
    {
        category: "Other",
        icon: React.createElement(MoreHorizontal, { className: "w-5 h-5 text-emerald-600" }),
        reasons: [
            { key: "other", label: "Other (please specify)" },
        ],
    },
];
