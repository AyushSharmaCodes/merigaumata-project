import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { Coupon } from "@/shared/types";
import { useUIStore } from "@/core/store/ui.store";
import { settingsApi } from "@/domains/settings";

export function useCouponsManagement() {
    const { t } = useTranslation();
    const { toast } = useToast();
    const setBlocking = useUIStore(state => state.setBlocking);
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [couponToDelete, setCouponToDelete] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCoupons, setTotalCoupons] = useState(0);
    const limit = 20;

    // Filters
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const fetchCoupons = useCallback(async () => {
        try {
            setLoading(true);
            const filters: any = {};

            if (typeFilter !== "all") filters.type = typeFilter;
            if (statusFilter === "active") filters.is_active = true;
            if (statusFilter === "inactive") filters.is_active = false;
            if (statusFilter === "expired") filters.expired = true;

            const data = await settingsApi.coupons.getAll({ ...filters, page, limit });
            setCoupons(data.coupons);
            setTotalPages(data.pagination.totalPages || 1);
            setTotalCoupons(data.pagination.total || 0);
        } catch (error) {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.coupons.toasts.loadFailed"),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [typeFilter, statusFilter, page, t, toast, limit]);

    useEffect(() => {
        setPage(1);
    }, [typeFilter, statusFilter]);

    useEffect(() => {
        fetchCoupons();
    }, [fetchCoupons]);

    const handleCreate = () => {
        setEditingCoupon(null);
        setDialogOpen(true);
    };

    const handleEdit = (coupon: Coupon) => {
        setEditingCoupon(coupon);
        setDialogOpen(true);
    };

    const handleSave = async () => {
        setBlocking(true);
        try {
            await fetchCoupons();
            setDialogOpen(false);
            setEditingCoupon(null);
        } finally {
            setBlocking(false);
        }
    };

    const handleDeleteClick = (id: string) => {
        setCouponToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!couponToDelete) return;

        setBlocking(true);
        try {
            await settingsApi.coupons.delete(couponToDelete);
            toast({
                title: t("common.success"),
                description: t("admin.coupons.toasts.deleteSuccess"),
            });
            await fetchCoupons();
        } catch (error) {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.coupons.toasts.deleteFailed"),
                variant: "destructive",
            });
        } finally {
            setBlocking(false);
            setDeleteDialogOpen(false);
            setCouponToDelete(null);
        }
    };

    return {
        t,
        coupons,
        loading,
        dialogOpen,
        setDialogOpen,
        editingCoupon,
        deleteDialogOpen,
        setDeleteDialogOpen,
        typeFilter,
        setTypeFilter,
        statusFilter,
        setStatusFilter,
        page,
        setPage,
        totalPages,
        totalCoupons,
        handleCreate,
        handleEdit,
        handleSave,
        handleDeleteClick,
        handleDeleteConfirm
    };
}
