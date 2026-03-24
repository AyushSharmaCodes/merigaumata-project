import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { managerService, Manager } from "@/services/manager.service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { ManagerDialog } from "@/components/admin/ManagerDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { MANAGER_PERMISSION_COUNT } from "@/constants/managerPermissions";

export default function ManagerManagement() {
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
            toast({ title: t("admin.managers.toasts.deleteSuccess") || "Manager deleted successfully" });
            setDeleteItem(null);
        },
        onError: (error: unknown) => {
            toast({
                title: t("admin.managers.toasts.deleteError"),
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    // Toggle status mutation
    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
            managerService.toggleStatus(id, is_active),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["managers"] });
            toast({ title: t("admin.managers.toasts.statusSuccess") || "Manager status updated" });
        },
        onError: (error: unknown) => {
            toast({
                title: t("admin.managers.toasts.statusError"),
                description: getErrorMessage(error),
                variant: "destructive",
            });
        },
    });

    const getPermissions = (manager: Manager) => {
        if (!manager.manager_permissions) return null;
        if (Array.isArray(manager.manager_permissions)) {
            return manager.manager_permissions[0] || null;
        }
        return manager.manager_permissions;
    };

    const getActivePermissionsCount = (manager: Manager) => {
        const perms = getPermissions(manager);
        if (!perms) return 0;
        return Object.entries(perms).filter(
            ([key, value]) => key.startsWith("can_manage_") && value === true
        ).length;
    };

    return (
        <>
            <ManagerDialog
                open={managerDialogOpen}
                onOpenChange={(open) => {
                    setManagerDialogOpen(open);
                    if (!open) setEditingManager(null);
                }}
                manager={editingManager}
            />

            <DeleteConfirmDialog
                open={!!deleteItem}
                onOpenChange={(open) => !open && setDeleteItem(null)}
                onConfirm={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
                title={t("admin.managers.delete.title")}
                description={t("admin.managers.delete.description", { name: deleteItem?.name })}
            />

            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">{t("admin.managers.title")}</h1>
                    <p className="text-muted-foreground">
                        {t("admin.managers.subtitle")}
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    {t("admin.managers.listTitle")}
                                </CardTitle>
                                <CardDescription>{t("admin.managers.totalManagers", { count: pagination?.total || managers.length })}</CardDescription>
                            </div>
                            <Button
                                onClick={() => {
                                    setEditingManager(null);
                                    setManagerDialogOpen(true);
                                }}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {t("admin.managers.addManager")}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <p className="text-center text-muted-foreground py-8">{t("admin.managers.loading")}</p>
                        ) : managers.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                {t("admin.managers.noManagers")}
                            </p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t("profile.personalInfo.name")}</TableHead>
                                        <TableHead>{t("profile.personalInfo.email")}</TableHead>
                                        <TableHead>{t("admin.managers.cols.createdBy")}</TableHead>
                                        <TableHead>{t("admin.managers.cols.permissions")}</TableHead>
                                        <TableHead>{t("common.status")}</TableHead>
                                        <TableHead>{t("admin.managers.cols.created")}</TableHead>
                                        <TableHead className="text-right">{t("common.actions")}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {managers.map((manager) => {
                                        const permissions = getPermissions(manager);
                                        const hasPermissions = !!permissions;
                                        const isActive = permissions ? permissions.is_active : false;

                                        return (
                                            <TableRow key={manager.id}>
                                                <TableCell className="font-medium">{manager.name}</TableCell>
                                                <TableCell>{manager.email}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="font-normal">
                                                            {manager.creator_name || t("common.system")}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">
                                                        {t("admin.managers.permissionsCount", { count: getActivePermissionsCount(manager), total: MANAGER_PERMISSION_COUNT })}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            checked={isActive}
                                                            disabled={!hasPermissions}
                                                            onCheckedChange={(checked) =>
                                                                toggleStatusMutation.mutate({
                                                                    id: manager.id,
                                                                    is_active: checked,
                                                                })
                                                            }
                                                        />
                                                        <Badge
                                                            variant={isActive ? "default" : "secondary"}
                                                        >
                                                            {isActive ? t("admin.managers.status.active") : t("admin.managers.status.inactive")}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(manager.created_at).toLocaleDateString(
                                                        i18n.language
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setEditingManager(manager);
                                                                setManagerDialogOpen(true);
                                                            }}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                setDeleteItem({ id: manager.id, name: manager.name })
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {t("admin.reviews.pagination.pageInfo", { current: pagination.page, total: pagination.totalPages })}
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                                {t("admin.reviews.pagination.previous")}
                            </Button>
                            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}>
                                {t("admin.reviews.pagination.next")}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
