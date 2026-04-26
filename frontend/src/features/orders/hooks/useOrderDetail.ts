import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orderService } from "@/domains/order";
import { adminAlertService } from "@/domains/admin";
import { useToast } from "@/shared/hooks/use-toast";
import { logger } from "@/core/observability/logger";
import type { Order } from "@/shared/types";

export function useOrderDetail(id: string | undefined) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [updating, setUpdating] = useState(false);
    const [statusToUpdate, setStatusToUpdate] = useState<string | null>(null);
    const [updateNotes, setUpdateNotes] = useState<string | undefined>(undefined);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [unsuccessfulDialogOpen, setUnsuccessfulDialogOpen] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [isAuditingReturn, setIsAuditingReturn] = useState(false);
    const [selectedReturnId, setSelectedReturnId] = useState<string | null>(null);

    // Parse query params for deep links
    const [searchParams] = useSearchParams();
    const queryReturnId = searchParams.get('returnId');

    // Sync query param to state
    useEffect(() => {
        if (queryReturnId) {
            setSelectedReturnId(queryReturnId);
            setIsAuditingReturn(true);
        }
    }, [queryReturnId]);

    // 1. Fetch Main Order Data
    const { 
        data: order, 
        isLoading: orderLoading
    } = useQuery({
        queryKey: ["admin-order", id],
        queryFn: () => orderService.getOrderById(id!),
        enabled: !!id,
        staleTime: 5000,
        refetchInterval: (query) => {
            const orderData = query.state.data as Order | undefined;
            return orderData?.view_state?.sync?.poll_interval_ms ?? 30000;
        },
        refetchIntervalInBackground: false,
    });

    // Helper to refresh all data manually
    const refreshData = useCallback(async () => {
        if (!id) return;
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["admin-order", id] }),
            adminAlertService.markAsReadByReferenceId('order', id)
        ]);
    }, [id, queryClient]);

    // Initial effect for mark as read (admin alert sync)
    useEffect(() => {
        if (id) {
            void adminAlertService.markAsReadByReferenceId('order', id);
        }
    }, [id]);

    const handleStatusUpdate = useCallback(async (newStatus: string, notes?: string) => {
        if (newStatus === 'delivery_unsuccessful') {
            setUnsuccessfulDialogOpen(true);
            return;
        }
        setStatusToUpdate(newStatus);
        setUpdateNotes(notes);
        setConfirmDialogOpen(true);
    }, []);

    const formatOrderStatusLabel = (status: string) =>
        t(`orderStatus.${status}`, {
            defaultValue: status
                .split("_")
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join(" ")
        });

    const handleConfirmStatusUpdate = useCallback(async () => {
        if (!id || !statusToUpdate) return;
        try {
            setUpdating(true);
            await orderService.updateStatus(id, statusToUpdate, updateNotes);
            toast({
                title: t("common.success"),
                description: t("admin.orders.detail.success.statusUpdated", {
                    status: formatOrderStatusLabel(statusToUpdate)
                }),
            });
            // Small delay to ensure DB propagation before cache invalidation
            await new Promise(r => setTimeout(r, 200));
            await refreshData();
        } catch (error) {
            logger.error("Status update failed", { id, statusToUpdate, error });
            toast({
                title: t("common.error"),
                description: t("admin.orders.detail.errors.statusUpdate"),
                variant: "destructive",
            });
        } finally {
            setUpdating(false);
            setConfirmDialogOpen(false);
            setStatusToUpdate(null);
            setUpdateNotes(undefined);
        }
    }, [id, statusToUpdate, updateNotes, t, toast, refreshData]);

    const handleReturnAction = useCallback(async (returnId: string, action: string, notes?: string) => {
        try {
            setUpdating(true);
            await orderService.updateReturnRequestStatus(returnId, action, notes);
            toast({
                title: t("common.success"),
                description: t("admin.orders.detail.success.returnUpdated"),
            });
            // Small delay to ensure DB propagation before cache invalidation
            await new Promise(r => setTimeout(r, 200));
            await refreshData();
        } catch (error) {
            logger.error("Return action failed", { returnId, action, error });
            toast({
                title: t("common.error"),
                description: t("admin.orders.detail.errors.returnAction"),
                variant: "destructive",
            });
        } finally {
            setUpdating(false);
        }
    }, [t, toast, refreshData]);

    const handleQCComplete = useCallback(async (returnItemId: string, qcData: any) => {
        try {
            setUpdating(true);
            await orderService.submitQCResult(returnItemId, qcData);
            toast({
                title: t("common.success"),
                description: t("admin.orders.detail.success.qcFinalized", "Quality Check finalized and outcome initiated."),
            });
            // Small delay to ensure DB propagation before cache invalidation
            await new Promise(r => setTimeout(r, 200));
            await refreshData();
        } catch (error) {
            logger.error("QC submission failed", { returnItemId, qcData, error });
            toast({
                title: t("common.error"),
                description: t("admin.orders.detail.errors.qcUpdate", "Failed to submit QC results"),
                variant: "destructive",
            });
        } finally {
            setUpdating(false);
        }
    }, [t, toast, refreshData]);

    const handleCancelOrder = useCallback(async (reason: string) => {
        if (!id) return;
        await handleStatusUpdate('cancelled_by_admin', reason);
        setCancelDialogOpen(false);
    }, [id, handleStatusUpdate]);

    const handleUnsuccessfulDelivery = useCallback(async (reason: string) => {
        if (!id) return;
        try {
            setUpdating(true);
            await orderService.updateStatus(id, 'delivery_unsuccessful', reason);
            toast({
                title: t("common.success"),
                description: t("admin.orders.detail.success.deliveryLogged", "Delivery failure record updated successfully."),
            });
            await new Promise(r => setTimeout(r, 200));
            await refreshData();
        } catch (error) {
            logger.error("Delivery failure log failed", { id, error });
            toast({
                title: t("common.error"),
                description: t("admin.orders.detail.errors.deliveryLog"),
                variant: "destructive",
            });
        } finally {
            setUpdating(false);
            setUnsuccessfulDialogOpen(false);
        }
    }, [id, t, toast, refreshData]);

    const handleRegenerateInvoice = useCallback(async () => {
        if (!id) return;
        try {
            setRegenerating(true);
            toast({
                title: t("common.processing", "Processing"),
                description: t("admin.orders.detail.invoice.generating", "Generating platform invoice, please wait..."),
            });
            await orderService.regenerateInvoice(id);
            toast({
                title: t("common.success"),
                description: t("admin.orders.detail.success.invoiceRegenerated", "Invoice has been regenerated successfully"),
            });
            await refreshData();
        } catch (error) {
            logger.error("Invoice regeneration failed", { id, error });
            toast({
                title: t("common.error"),
                description: t("admin.orders.detail.errors.invoiceRegeneration", "Failed to regenerate invoice"),
                variant: "destructive",
            });
        } finally {
            setRegenerating(false);
        }
    }, [id, t, toast, refreshData]);

    const sortedHistory = useMemo(() => {
        const history = order?.order_status_history || [];
        return [...history].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }, [order?.order_status_history]);

    const returnRequests = useMemo(() => {
        const requests = order?.return_requests || [];
        return [...requests].sort((a, b) =>
            new Date(b.updated_at || b.created_at || 0).getTime() -
            new Date(a.updated_at || a.created_at || 0).getTime()
        );
    }, [order]);

    const activeReturnRequest = useMemo(() => {
        if (selectedReturnId) {
            return returnRequests.find((r: any) => r.id === selectedReturnId) || null;
        }
        const activeReturnId = order?.view_state?.lifecycle?.active_return_request_id;
        if (activeReturnId) {
            return returnRequests.find((r: any) => r.id === activeReturnId) || null;
        }
        if (returnRequests.length === 0) return null;
        return returnRequests[0];
    }, [order?.view_state?.lifecycle?.active_return_request_id, returnRequests, selectedReturnId]);

    const hasReturnHistory = useMemo(() =>
        returnRequests.length > 0
    , [returnRequests]);

    return {
        order,
        orderLoading,
        updating,
        statusToUpdate,
        confirmDialogOpen,
        setConfirmDialogOpen,
        cancelDialogOpen,
        setCancelDialogOpen,
        unsuccessfulDialogOpen,
        setUnsuccessfulDialogOpen,
        regenerating,
        isAuditingReturn,
        setIsAuditingReturn,
        selectedReturnId,
        setSelectedReturnId,
        activeReturnRequest,
        hasReturnHistory,
        sortedHistory,
        returnRequests,
        handleStatusUpdate,
        handleConfirmStatusUpdate,
        handleReturnAction,
        handleQCComplete,
        handleCancelOrder,
        handleUnsuccessfulDelivery,
        handleRegenerateInvoice,
        refreshData,
        formatOrderStatusLabel: (status: string) => formatOrderStatusLabel(status)
    };
}
