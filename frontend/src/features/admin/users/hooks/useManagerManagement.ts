import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { managerService, type Manager } from "@/domains/admin";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { MANAGER_PERMISSION_KEYS } from "@/shared/constants/managerPermissions";

export function useManagerManagement() {
    const { t, i18n } = useTranslation();
    const [managerDialogOpen, setManagerDialogOpen] = useState(false);
    const [editingManager, setEditingManager] = useState<Manager | null>(null);
    const [deleteItem, setDeleteItem] = useState<{ id: string; name: string } | null>(null);
    const [page, setPage] = useState(1);
    const limit = 10;

    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch managers
    const { data, isLoading } = useQuery({
        queryKey: ["managers", page],
        queryFn: () => managerService.getAll({ page, limit }),
    });
    const managers = data?.managers || [];
    const pagination = data?.pagination;

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: (id: string) => managerService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["managers"] });
            toast({ title: t("admin.managers.toasts.deleteSuccess", { defaultValue: "Manager deleted successfully" }) });
            setDeleteItem(null);
        },
        onError: (error: unknown) => {
            toast({
                title: t("admin.managers.toasts.deleteError", { defaultValue: "Error deleting manager" }),
                description: getErrorMessage(error, t, "admin.managers.toasts.deleteError"),
                variant: "destructive",
            });
        },
    });

    const toggleStatusMutation = useMutation({
        mutationFn: (data: { id: string; is_active: boolean }) =>
            managerService.toggleStatus(data.id, data.is_active),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["managers"] });
            toast({ title: t("admin.managers.toasts.statusSuccess", { defaultValue: "Status updated successfully" }) });
        },
        onError: (error: unknown) => {
            toast({
                title: t("admin.managers.toasts.statusError", { defaultValue: "Error updating status" }),
                description: getErrorMessage(error, t, "admin.managers.toasts.statusError"),
                variant: "destructive",
            });
        },
    });

    const resendVerificationMutation = useMutation({
        mutationFn: (id: string) => managerService.resendVerification(id),
        onSuccess: (data) => {
            toast({ title: data.message });
        },
        onError: (error: unknown) => {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "common.error"),
                variant: "destructive",
            });
        },
    });

    const reissueTemporaryPasswordMutation = useMutation({
        mutationFn: (id: string) => managerService.reissueTemporaryPassword(id),
        onSuccess: (data) => {
            toast({ title: data.message });
        },
        onError: (error: unknown) => {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "common.error"),
                variant: "destructive",
            });
        },
    });

    const getPermissions = (manager: Manager) => {
        return Array.isArray(manager.manager_permissions)
            ? manager.manager_permissions[0]
            : manager.manager_permissions;
    };

    const getActivePermissionsCount = (manager: Manager) => {
        const perms = getPermissions(manager);
        if (!perms) return 0;

        // Count all boolean permissions that are set to true
        // Exclude internal metadata keys
        const metadataKeys = ["id", "user_id", "is_active", "created_at", "updated_at"];
        return Object.entries(perms).filter(
            ([key, value]) => !metadataKeys.includes(key) && value === true
        ).length;
    };

    return {
        t,
        i18n,
        managerDialogOpen,
        setManagerDialogOpen,
        editingManager,
        setEditingManager,
        deleteItem,
        setDeleteItem,
        page,
        setPage,
        managers,
        pagination,
        isLoading,
        deleteMutation,
        toggleStatusMutation,
        resendVerificationMutation,
        reissueTemporaryPasswordMutation,
        getPermissions,
        getActivePermissionsCount,
    };
}
