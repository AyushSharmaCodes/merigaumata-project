import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/shared/hooks/use-toast";
import { apiClient } from "@/core/api/api-client";
import { format } from "date-fns";
import { usePortalPath } from "@/shared/hooks/usePortalPath";
import { useUIStore } from "@/core/store/ui.store";
import { downloadCSV, flattenObject } from "@/core/utils/exportUtils";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { logger } from "@/core/observability/logger";
import { Order, OrderStatus, ReturnRequest } from "@/shared/types";
import { orderQueryKeys, useAdminOrders, useUpdateOrderStatus } from "@/domains/order";

export function useAdminOrdersPage() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const navigate = useNavigate();
    const { basePath } = usePortalPath();
    const setBlocking = useUIStore((state) => state.setBlocking);
    const queryClient = useQueryClient();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [newStatus, setNewStatus] = useState<OrderStatus | "">("");
    const [activeReturnRequest, setActiveReturnRequest] = useState<ReturnRequest | null>(null);
    const [returnDetailsLoading, setReturnDetailsLoading] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);
    const [searchParams, setSearchParams] = useSearchParams();
    const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
    const [paymentFilter, setPaymentFilter] = useState(searchParams.get("paymentStatus") || "all");
    const initialLoadDone = useRef(false);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        if (!initialLoadDone.current) {
            const urlStatus = searchParams.get("status");
            const urlPayment = searchParams.get("paymentStatus");
            if (urlStatus && urlStatus !== statusFilter) setStatusFilter(urlStatus);
            if (urlPayment && urlPayment !== paymentFilter) setPaymentFilter(urlPayment);
            initialLoadDone.current = true;
        }
    }, [searchParams, statusFilter, paymentFilter]);

    useEffect(() => {
        setCurrentPage(1);
        // Optionally update URL search params
        const newParams = new URLSearchParams(searchParams);
        if (statusFilter !== 'all') newParams.set('status', statusFilter); else newParams.delete('status');
        if (paymentFilter !== 'all') newParams.set('paymentStatus', paymentFilter); else newParams.delete('paymentStatus');
        setSearchParams(newParams, { replace: true });
    }, [searchQuery, statusFilter, paymentFilter, setSearchParams, searchParams]);

    // Using the custom hook from features/orders/hooks
    const { data: ordersResponse, isLoading, isFetching, refetch } = useAdminOrders({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        all: 'true',
        orderNumber: searchQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        payment_status: paymentFilter !== 'all' ? paymentFilter : undefined,
    });

    const allOrders = ordersResponse?.data || [];

    useEffect(() => {
        if (ordersResponse?.meta) {
            setTotalOrders(ordersResponse.meta.total || 0);
            setTotalPages(ordersResponse.meta.totalPages || 1);
        }
    }, [ordersResponse]);

    const updateStatusMutation = useUpdateOrderStatus();

    const handleStatusUpdate = async () => {
        if (selectedOrder && newStatus) {
            if (
                (newStatus === 'return_approved' || newStatus === 'return_rejected') &&
                activeReturnRequest
            ) {
                setBlocking(true);
                try {
                    if (newStatus === 'return_approved') {
                        await apiClient.post(`/returns/${activeReturnRequest.id}/approve`, {});
                        toast({ title: t("common.success"), description: t("admin.orders.toasts.returnApproved") });
                    } else {
                        await apiClient.post(`/returns/${activeReturnRequest.id}/reject`, { reason: "Rejected by admin" });
                        toast({ title: t("common.success"), description: t("admin.orders.toasts.returnRejected") });
                    }
                    queryClient.invalidateQueries({ queryKey: orderQueryKeys.all });
                    queryClient.invalidateQueries({ queryKey: ["admin-orders-stats"] });
                    setStatusDialogOpen(false);
                    setNewStatus("");
                    setActiveReturnRequest(null);
                    return;
                } catch (error: unknown) {
                    toast({
                        title: t("common.error"),
                        description: getErrorMessage(error, t, "admin.orders.toasts.returnActionFailed"),
                        variant: "destructive",
                    });
                    return;
                } finally {
                    setBlocking(false);
                }
            }

            updateStatusMutation.mutate({
                id: selectedOrder.id,
                status: newStatus as OrderStatus,
            }, {
                onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: ["admin-orders-stats"] });
                    toast({ title: t("common.success"), description: t("admin.orders.toasts.updateSuccess") });
                    setStatusDialogOpen(false);
                    setNewStatus("");
                },
                onError: () => {
                    toast({ title: t("common.error"), description: t("admin.orders.toasts.updateFailed"), variant: "destructive" });
                }
            });
        }
    };

    const fetchReturnDetails = async (orderId: string) => {
        setReturnDetailsLoading(true);
        try {
            const response = await apiClient.get(`/returns/orders/${orderId}/active`);
            setActiveReturnRequest(response.data);
        } catch (error) {
            logger.error("Failed to fetch return details", error);
            setActiveReturnRequest(null);
        } finally {
            setReturnDetailsLoading(false);
        }
    };

    const handleExport = (orders: Order[], filename: string) => {
        if (orders.length === 0) {
            toast({ title: t("common.error"), description: t("admin.orders.export.noData", { defaultValue: "No orders to export" }), variant: "destructive" });
            return;
        }

        const exportData = orders.map((order) =>
            flattenObject({
                id: order.id,
                userId: order.userId,
                status: order.status,
                paymentStatus: order.paymentStatus || order.payment_status,
                total: order.total,
                itemCount: order.items.length,
                createdAt: format(new Date(order.createdAt || order.created_at), "yyyy-MM-dd HH:mm:ss"),
                shippingCity: order.shippingAddress?.city || order.shipping_address?.city || 'N/A',
                shippingState: order.shippingAddress?.state || order.shipping_address?.state || 'N/A',
            })
        );

        downloadCSV(exportData, filename);
        toast({ title: t("common.success"), description: t("admin.orders.export.success", { defaultValue: "Orders exported successfully" }) });
    };

    return {
        t,
        navigate,
        basePath,
        searchQuery,
        setSearchQuery,
        selectedOrder,
        setSelectedOrder,
        detailsOpen,
        setDetailsOpen,
        statusDialogOpen,
        setStatusDialogOpen,
        newStatus,
        setNewStatus,
        activeReturnRequest,
        returnDetailsLoading,
        currentPage,
        setCurrentPage,
        totalPages,
        totalOrders,
        statusFilter,
        setStatusFilter,
        paymentFilter,
        setPaymentFilter,
        allOrders,
        isLoading,
        isFetching,
        refetch,
        queryClient,
        handleStatusUpdate,
        fetchReturnDetails,
        handleExport
    };
}
