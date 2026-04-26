import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage, getFriendlyTitle } from "@/core/utils/errorUtils";
import { logger } from "@/core/observability/logger";
import { hasAcceptedCookieConsent, requestCookieConsentForCriticalAction } from "@/shared/lib/cookie-consent";
import { OrderMessages } from "@/shared/constants/messages/OrderMessages";
import { ordersApi } from "@/domains/order";
import type { ReturnSuccessState, SubmitReturnInput } from "@/domains/order/model/user-order-detail.types";
import {
    createReturnSuccessState,
    getLatestReturnRequest,
    orderQueryKeys,
    useOrderDetailQuery,
    useOrderReturnableItemsQuery,
    useOrderReturnsQuery,
} from "@/domains/order";

export function useUserOrderDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [cancelOpen, setCancelOpen] = useState(false);
    const [returnOpen, setReturnOpen] = useState(false);
    const [shouldLoadReturnableItems, setShouldLoadReturnableItems] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [returnSuccessData, setReturnSuccessData] = useState<ReturnSuccessState | null>(null);

    const orderQuery = useOrderDetailQuery(id);
    const returnsQuery = useOrderReturnsQuery(id, { fallbackToEmpty: true });
    const returnableItemsQuery = useOrderReturnableItemsQuery(id, {
        enabled: shouldLoadReturnableItems && returnOpen,
        fallbackToEmpty: true,
    });

    useEffect(() => {
        if (!orderQuery.error) {
            return;
        }

        toast({
            title: t("common.error"),
            description: t(OrderMessages.LOADING_ERROR || "orderDetail.loadError"),
            variant: "destructive",
        });
        navigate("/my-orders");
    }, [navigate, orderQuery.error, t, toast]);

    const invalidateOrderDetail = async () => {
        if (!id) {
            return;
        }

        await Promise.all([
            queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(id) }),
            queryClient.invalidateQueries({ queryKey: orderQueryKeys.returns(id) }),
            queryClient.invalidateQueries({ queryKey: orderQueryKeys.returnableItems(id) }),
        ]);
    };

    const cancelOrderMutation = useMutation({
        mutationFn: async (reason: string) => ordersApi.cancelOrder(id as string, reason),
        onMutate: () => {
            setLoadingMessage(t(OrderMessages.CANCELLING_ORDER));
            setCancelOpen(false);
        },
        onSuccess: async () => {
            toast({
                title: t("common.success"),
                description: t(OrderMessages.CANCEL_SUCCESS),
            });
            await invalidateOrderDetail();
        },
        onError: (error) => {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t as typeof t, OrderMessages.CANCEL_ERROR),
                variant: "destructive",
            });
        },
        onSettled: () => {
            setLoadingMessage("");
        },
    });

    const submitReturnMutation = useMutation({
        mutationFn: async (input: SubmitReturnInput) => ordersApi.submitReturnRequest(id as string, input),
        onMutate: () => {
            setLoadingMessage(t(OrderMessages.SUBMITTING_RETURN));
        },
        onSuccess: async (response) => {
            toast({
                title: t("common.success"),
                description: t(OrderMessages.RETURN_SUBMIT_SUCCESS),
            });

            setReturnSuccessData(
                createReturnSuccessState(
                    response,
                    orderQuery.data?.order_number || "Unknown",
                    id || "UNKNOWN"
                )
            );
            setReturnOpen(false);
            await invalidateOrderDetail();
        },
        onError: (error) => {
            if (axios.isAxiosError(error)) {
                void logger.error("Return request failed", {
                    module: "useUserOrderDetailPage",
                    orderId: id,
                    status: error.response?.status,
                    responseData: error.response?.data,
                });
            } else {
                void logger.error("Return request failed", {
                    module: "useUserOrderDetailPage",
                    orderId: id,
                    error,
                });
            }

            toast({
                title: getFriendlyTitle(error, t),
                description: getErrorMessage(error, t as typeof t, OrderMessages.RETURN_SUBMIT_ERROR),
                variant: "destructive",
            });
        },
        onSettled: () => {
            setLoadingMessage("");
        },
    });

    const handleOpenReturnDialog = async () => {
        if (!hasAcceptedCookieConsent()) {
            requestCookieConsentForCriticalAction("/returns/request");
            return;
        }

        setReturnOpen(true);
        setShouldLoadReturnableItems(true);
        await returnableItemsQuery.refetch();
    };

    const handleSubmitReturn = async (input: SubmitReturnInput) => {
        if (!hasAcceptedCookieConsent()) {
            requestCookieConsentForCriticalAction("/returns/request");
            return;
        }

        await submitReturnMutation.mutateAsync(input);
    };

    const latestReturn = useMemo(
        () => getLatestReturnRequest(returnsQuery.data ?? []),
        [returnsQuery.data]
    );

    return {
        orderId: id ?? "",
        order: orderQuery.data ?? null,
        returns: returnsQuery.data ?? [],
        returnableItems: returnableItemsQuery.data ?? [],
        returnSuccessData,
        cancelOpen,
        returnOpen,
        loadingMessage,
        isLoading: orderQuery.isLoading,
        isActionLoading:
            cancelOrderMutation.isPending ||
            submitReturnMutation.isPending,
        isOpeningReturnDialog: returnOpen && returnableItemsQuery.isFetching,
        canCancel: orderQuery.data?.view_state?.actions.can_cancel_order ?? false,
        canReturn: orderQuery.data?.view_state?.actions.can_request_return ?? false,
        latestReturn,
        setCancelOpen,
        setReturnOpen,
        setReturnSuccessData,
        handleCancelOrder: async (reason: string) => cancelOrderMutation.mutateAsync(reason),
        handleOpenReturnDialog,
        handleSubmitReturn,
        navigateToContact: () => navigate("/contact"),
    };
}
