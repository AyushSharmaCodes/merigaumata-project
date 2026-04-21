import { 
    UserX, 
    Home, 
    Banknote, 
    PackageX, 
    MapPinOff, 
    Truck, 
    CloudRain, 
    ShieldAlert, 
    MessageSquareOff, 
    AlertTriangle, 
    Pencil 
} from "lucide-react";
import React from "react";

export interface DeliveryUnsuccessfulReason {
    key: string;
    label: string;
}

export interface UnsuccessfulDeliveryCategory {
    category: string;
    icon?: React.ComponentType<{ className?: string }>;
    reasons: DeliveryUnsuccessfulReason[];
}

export const UNSUCCESSFUL_DELIVERY_REASONS: UnsuccessfulDeliveryCategory[] = [
    {
        category: "Customer Not Available",
        icon: UserX,
        reasons: [
            { key: "customer_not_reachable", label: "Customer not reachable (phone switched off / no response)" },
            { key: "customer_unavailable", label: "Customer unavailable at delivery address" },
            { key: "delivery_attempt_exceeded", label: "Delivery attempt exceeded (multiple failed attempts)" },
        ],
    },
    {
        category: "Address Issues",
        icon: Home,
        reasons: [
            { key: "incorrect_address", label: "Incorrect / incomplete address" },
            { key: "address_not_locatable", label: "Address not locatable on map" },
            { key: "landmark_missing", label: "Landmark missing / unclear" },
            { key: "address_change_unserviceable", label: "Customer requested address change (not serviceable)" },
        ],
    },
    {
        category: "Payment-Related (COD)",
        icon: Banknote,
        reasons: [
            { key: "cod_refused", label: "Customer refused to pay (COD)" },
            { key: "doorstep_cancellation", label: "Customer requested cancellation at doorstep" },
            { key: "amount_mismatch", label: "Amount mismatch dispute" },
        ],
    },
    {
        category: "Customer Refusal",
        icon: PackageX,
        reasons: [
            { key: "customer_refused_delivery", label: "Customer refused to accept delivery" },
            { key: "no_longer_required", label: "Product no longer required" },
            { key: "ordered_by_mistake_refused", label: "Ordered by mistake (refused at delivery)" },
        ],
    },
    {
        category: "Serviceability & Location Issues",
        icon: MapPinOff,
        reasons: [
            { key: "area_unserviceable", label: "Area not serviceable by courier" },
            { key: "remote_restricted_area", label: "Remote / restricted area" },
            { key: "entry_restricted", label: "Entry restricted (e.g., office, society, security denial)" },
        ],
    },
    {
        category: "Logistics & Courier Issues",
        icon: Truck,
        reasons: [
            { key: "vehicle_breakdown", label: "Delivery vehicle breakdown" },
            { key: "courier_unable_to_reach", label: "Courier unable to reach location" },
            { key: "operational_issue", label: "Route or operational issue" },
            { key: "excessive_delay", label: "Delivery delayed beyond acceptable time" },
        ],
    },
    {
        category: "External Factors",
        icon: CloudRain,
        reasons: [
            { key: "bad_weather", label: "Bad weather conditions" },
            { key: "natural_disaster", label: "Natural disaster / emergency" },
            { key: "local_disturbance", label: "Local strike / lockdown / curfew" },
        ],
    },
    {
        category: "Security / Access Issues",
        icon: ShieldAlert,
        reasons: [
            { key: "security_denied", label: "Security denied entry (apartment/office)" },
            { key: "otp_not_provided", label: "Customer did not provide OTP (if required)" },
            { key: "id_verification_failed", label: "ID verification failed" },
        ],
    },
    {
        category: "Communication Issues",
        icon: MessageSquareOff,
        reasons: [
            { key: "incorrect_contact_number", label: "Incorrect contact number" },
            { key: "no_response_communication", label: "Customer not responding to calls/messages" },
        ],
    },
    {
        category: "Other Operational Issues",
        icon: AlertTriangle,
        reasons: [
            { key: "package_lost", label: "Package lost in transit" },
            { key: "package_damaged", label: "Package damaged during transit (detected before delivery)" },
            { key: "wrong_package_dispatched", label: "Wrong package dispatched" },
        ],
    },
    {
        category: "Other",
        icon: Pencil,
        reasons: [
            { key: "other", label: "Other (with remarks)" },
        ],
    },
];
