import type { ReturnRequest } from "@/shared/types";
import type { CreateReturnRequestResponse, ReturnSuccessState, SubmitReturnInput } from "../model/user-order-detail.types";

export const orderQueryKeys = {
    all: ["orders"] as const,
    detail: (orderId: string) => ["orders", "detail", orderId] as const,
    returns: (orderId: string) => ["orders", "returns", orderId] as const,
    returnableItems: (orderId: string) => ["orders", "returnable-items", orderId] as const,
    returnDetail: (returnId: string) => ["orders", "returns", "detail", returnId] as const,
};

export function formatReturnRequestId(returnId: string): string {
    const idSuffix = returnId.includes("-")
        ? returnId.split("-").pop()?.toUpperCase()
        : returnId.substring(0, 8).toUpperCase();

    return `RTN-${idSuffix ?? returnId.substring(0, 8).toUpperCase()}`;
}

export function getLatestReturnRequest(returns: ReturnRequest[]): ReturnRequest | null {
    if (!returns.length) {
        return null;
    }

    return [...returns].sort(
        (left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime()
    )[0] ?? null;
}

export function buildReturnRequestPayload(
    orderId: string,
    input: SubmitReturnInput,
    uploadedImageUrls: string[]
) {
    const reasonLabel = `${input.reasonCategory}: ${input.specificReason}`;

    return {
        orderId,
        items: input.selectedItems.map((item) => ({
            orderItemId: item.id,
            quantity: item.quantity,
            reason: reasonLabel,
            images: uploadedImageUrls,
            condition: "opened",
        })),
        reason: input.additionalDetails || reasonLabel,
    };
}

export function createReturnSuccessState(
    response: CreateReturnRequestResponse,
    orderNumber: string,
    fallbackId: string
): ReturnSuccessState {
    const rawReturnId = response.returnRequest?.id || response.id || fallbackId || "UNKNOWN";

    return {
        returnRequestId: formatReturnRequestId(rawReturnId),
        orderNumber,
    };
}

export function getFeatureErrorMessage(error: unknown, fallbackMessage: string): string {
    if (typeof error === "object" && error !== null) {
        const typedError = error as {
            message?: string;
            response?: {
                data?: {
                    error?: string;
                    message?: string;
                };
            };
        };

        return (
            typedError.response?.data?.error ||
            typedError.response?.data?.message ||
            typedError.message ||
            fallbackMessage
        );
    }

    if (typeof error === "string" && error.trim()) {
        return error;
    }

    return fallbackMessage;
}
