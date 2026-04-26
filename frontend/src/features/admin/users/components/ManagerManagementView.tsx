import { useManagerManagement } from "@/features/admin/users";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/components/ui/table";
import { KeyRound, Loader2, Mail, Pencil, Plus, Trash2, Users } from "lucide-react";
import { ManagerDialog } from "@/features/admin/users";
import { DeleteConfirmDialog } from "@/features/admin";
import { MANAGER_PERMISSION_COUNT } from "@/shared/constants/managerPermissions";

export function ManagerManagementView() {
    const {
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
    } = useManagerManagement();

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
                                        const isInvitePending = manager.email_verified === false;
                                        const isBusy = resendVerificationMutation.isPending || reissueTemporaryPasswordMutation.isPending;

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
                                                    <div className="flex items-center gap-2 flex-wrap">
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
                                                        <Badge variant={isInvitePending ? "outline" : "secondary"}>
                                                            {isInvitePending
                                                                ? t("admin.managers.status.invitePending", { defaultValue: "Invite Pending" })
                                                                : t("admin.managers.status.verified", { defaultValue: "Verified" })}
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
                                                            disabled={!isInvitePending || isBusy}
                                                            onClick={() =>
                                                                resendVerificationMutation.mutate(manager.id)
                                                            }
                                                            title={t("admin.managers.actions.resendInvite", { defaultValue: "Resend verification email" })}
                                                        >
                                                            {resendVerificationMutation.isPending && resendVerificationMutation.variables === manager.id
                                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                : <Mail className="h-4 w-4" />}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={isInvitePending || isBusy}
                                                            onClick={() =>
                                                                reissueTemporaryPasswordMutation.mutate(manager.id)
                                                            }
                                                            title={t("admin.managers.actions.reissuePassword", { defaultValue: "Reissue temporary password" })}
                                                        >
                                                            {reissueTemporaryPasswordMutation.isPending && reissueTemporaryPasswordMutation.variables === manager.id
                                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                : <KeyRound className="h-4 w-4" />}
                                                        </Button>
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
