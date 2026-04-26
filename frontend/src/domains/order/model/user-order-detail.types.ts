import type {
    Address,
    Invoice,
    Order,
    OrderItem,
    OrderStatusHistory,
    OrderViewState,
    Product,
    ReturnRequest,
    ReturnableItem,
} from "@/shared/types";

export interface OrderAddressSnapshot extends Partial<Address> {
    full_name?: string;
    address_line1?: string;
    address_line2?: string;
    addressLine2?: string;
    postal_code?: string;
}

export interface UserOrderDetailVariant {
    id: string;
    size_label: string;
    size_label_i18n?: Record<string, string>;
    size_value: number;
    unit: string;
    description?: string;
    description_i18n?: Record<string, string>;
    variant_image_url?: string;
    gst_rate?: number;
    sku?: string;
}

export interface UserOrderDetailItem extends Omit<OrderItem, "product" | "variant"> {
    product?: Product;
    remaining_quantity?: number;
    price_includes_tax?: boolean;
    variant?: UserOrderDetailVariant;
    delivery_calculation_snapshot?: {
        source?: string;
        delivery_refund_policy?: "REFUNDABLE" | "NON_REFUNDABLE" | "PARTIAL";
        non_refundable_delivery_charge?: number;
        non_refundable_delivery_gst?: number;
        [key: string]: unknown;
    };
}

export interface OrderRefund {
    id: string;
    razorpay_refund_id: string;
    amount: number;
    status: string;
    created_at: string;
    notes?: string;
}

export interface UserOrderDetailOrder extends Omit<Order, "items" | "shipping_address" | "billing_address" | "payment_status" | "payment_method" | "invoices"> {
    items: UserOrderDetailItem[];
    shipping_address?: OrderAddressSnapshot;
    billing_address?: OrderAddressSnapshot;
    payment_status?: string;
    payment_method?: string;
    payment_id?: string;
    invoice_id?: string;
    invoice_url?: string;
    invoices?: Invoice[];
    total_taxable_amount?: number;
    total_cgst?: number;
    total_sgst?: number;
    total_igst?: number;
    delivery_gst_mode?: string;
    delivery_unsuccessful_reason?: string | null;
    refunds?: OrderRefund[];
    return_requests?: ReturnRequest[];
    view_state?: OrderViewState;
    order_status_history: OrderStatusHistory[];
}

export interface SubmitReturnInput {
    selectedItems: Array<{
        id: string;
        quantity: number;
    }>;
    reasonCategory: string;
    specificReason: string;
    additionalDetails: string;
    images: File[];
}

export interface ReturnSuccessState {
    returnRequestId: string;
    orderNumber: string;
}

export interface CreateReturnRequestResponse {
    id?: string;
    returnRequest?: {
        id?: string;
    };
}

export interface UserOrderDetailViewModel {
    order: UserOrderDetailOrder | null;
    returns: ReturnRequest[];
    returnableItems: ReturnableItem[];
    isLoading: boolean;
    isActionLoading: boolean;
    isOpeningReturnDialog: boolean;
    loadingMessage: string;
    cancelOpen: boolean;
    returnOpen: boolean;
    returnSuccessData: ReturnSuccessState | null;
    canCancel: boolean;
    canReturn: boolean;
}
