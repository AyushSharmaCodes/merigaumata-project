import { 
    PackageSearch, 
    CreditCard, 
    Truck, 
    ShieldAlert, 
    Settings, 
    User, 
    Package, 
    Gavel, 
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

export const CANCELLATION_REASONS: ReasonsCategory[] = [
    {
        category: "Inventory & Product Issues",
        icon: PackageSearch,
        reasons: [
            { key: "out_of_stock", label: "Out of stock after order placement" },
            { key: "inventory_mismatch", label: "Inventory mismatch / overselling" },
            { key: "product_discontinued", label: "Product discontinued" },
            { key: "damaged_item", label: "Damaged or defective item detected before dispatch" },
        ],
    },
    {
        category: "Payment Issues",
        icon: CreditCard,
        reasons: [
            { key: "payment_failed", label: "Payment not received / failed" },
            { key: "suspicious_payment", label: "Payment flagged as suspicious" },
            { key: "cod_not_confirmed", label: "COD order not confirmed by customer" },
            { key: "pricing_error", label: "Pricing or discount error in order" },
        ],
    },
    {
        category: "Logistics & Delivery Issues",
        icon: Truck,
        reasons: [
            { key: "delivery_unserviceable", label: "Delivery not serviceable in customer location" },
            { key: "courier_unavailable", label: "Courier partner unavailable" },
            { key: "expected_delay", label: "Excessive delivery delay expected" },
            { key: "invalid_address", label: "Address incomplete or invalid" },
        ],
    },
    {
        category: "Fraud & Risk Control",
        icon: ShieldAlert,
        reasons: [
            { key: "fraudulent_order", label: "Order flagged as fraudulent" },
            { key: "multiple_suspicious_orders", label: "Multiple suspicious orders from same user" },
            { key: "high_risk_transaction", label: "High-risk transaction detected" },
        ],
    },
    {
        category: "Operational / Internal Issues",
        icon: Settings,
        reasons: [
            { key: "duplicate_order", label: "Duplicate order created" },
            { key: "system_error", label: "Technical/system error" },
            { key: "processing_mistake", label: "Order processing mistake" },
            { key: "vendor_unable", label: "Seller/vendor unable to fulfill" },
        ],
    },
    {
        category: "Customer-Related (Admin-Initiated)",
        icon: User,
        reasons: [
            { key: "customer_requested", label: "Customer requested cancellation (via support)" },
            { key: "customer_unreachable", label: "Customer unreachable for confirmation" },
            { key: "customer_refused", label: "Customer refused order (pre-dispatch)" },
        ],
    },
    {
        category: "Vendor / Supplier Issues",
        icon: Package,
        reasons: [
            { key: "supplier_out_of_stock", label: "Supplier out of stock" },
            { key: "vendor_rejected", label: "Vendor rejected the order" },
            { key: "procurement_delay", label: "Procurement delay" },
        ],
    },
    {
        category: "Policy / Compliance",
        icon: Gavel,
        reasons: [
            { key: "policy_violation", label: "Order violates platform policy" },
            { key: "restricted_item", label: "Restricted item in shipping region" },
            { key: "legal_restriction", label: "Legal or regulatory restriction" },
        ],
    },
    {
        category: "Other",
        icon: Pencil,
        reasons: [
            { key: "other", label: "Other (with note)" },
        ],
    },
];

