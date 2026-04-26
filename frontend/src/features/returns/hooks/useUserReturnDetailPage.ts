import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    getFeatureErrorMessage,
    useOrderBaseDetailQuery,
    useOrderReturnsQuery,
    useReturnDetailQuery,
} from "@/domains/order";

export function useUserReturnDetailPage() {
    const { id: orderId, returnId } = useParams<{ id: string; returnId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const orderQuery = useOrderBaseDetailQuery(orderId);
    const returnsQuery = useOrderReturnsQuery(orderId);
    const returnDetailQuery = useReturnDetailQuery(returnId);

    const error = useMemo(() => {
        if (orderQuery.error) {
            return getFeatureErrorMessage(orderQuery.error, t("orderDetail.loadError", "Failed to load order details"));
        }

        if (returnsQuery.error) {
            return getFeatureErrorMessage(returnsQuery.error, t("common.error", "Failed to load return details"));
        }

        if (returnDetailQuery.error) {
            return getFeatureErrorMessage(returnDetailQuery.error, t("common.error", "Failed to load return details"));
        }

        return null;
    }, [orderQuery.error, returnsQuery.error, returnDetailQuery.error, t]);

    return {
        orderId: orderId ?? "",
        returnId: returnId ?? "",
        order: orderQuery.data ?? null,
        returns: returnsQuery.data ?? [],
        returnRequest: returnDetailQuery.data ?? null,
        error,
        isLoadingOrder: orderQuery.isLoading,
        isLoadingReturn: returnDetailQuery.isLoading || returnsQuery.isLoading,
        navigateBackToOrder: () => navigate(`/my-orders/${orderId}`),
    };
}
