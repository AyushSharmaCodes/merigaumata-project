import { Button } from "@/shared/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import {
    Plus,
    Pencil,
    Trash2,
    Tag as TagIcon,
    Loader2,
    Filter,
} from "lucide-react";
import { CouponDialog } from "@/features/admin/promotions";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useCouponsManagement } from "../hooks/useCouponsManagement";

export const CouponsManagementPage = () => {
    const {
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
    } = useCouponsManagement();

    const isExpired = (validUntil: string) => {
        return new Date(validUntil) < new Date();
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("admin.coupons.create")}
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        {t("admin.coupons.filters.title")}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <div className="w-48">
                            <label htmlFor="type-filter" className="text-sm font-medium mb-2 block">{t("admin.coupons.filters.type")}</label>
                            <select 
                                value={typeFilter} 
                                onChange={(e) => setTypeFilter(e.target.value)} 
                                id="type-filter" 
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="all">{t("admin.coupons.filters.types.all")}</option>
                                <option value="cart">{t("admin.coupons.filters.types.cart")}</option>
                                <option value="category">{t("admin.coupons.filters.types.category")}</option>
                                <option value="product">{t("admin.coupons.filters.types.product")}</option>
                                <option value="variant">{t("admin.coupons.filters.types.variant")}</option>
                                <option value="free_delivery">{t("admin.coupons.filters.types.freeDelivery")}</option>
                            </select>
                        </div>

                        <div className="w-48">
                            <label htmlFor="status-filter" className="text-sm font-medium mb-2 block">{t("admin.coupons.filters.status")}</label>
                            <select 
                                value={statusFilter} 
                                onChange={(e) => setStatusFilter(e.target.value)} 
                                id="status-filter" 
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="all">{t("admin.coupons.filters.statuses.all")}</option>
                                <option value="active">{t("admin.coupons.filters.statuses.active")}</option>
                                <option value="inactive">{t("admin.coupons.filters.statuses.inactive")}</option>
                                <option value="expired">{t("admin.coupons.filters.statuses.expired")}</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Coupons Table */}
            <Card>
                <CardHeader>
                    <CardTitle>{t("admin.coupons.table.title", { count: totalCoupons })}</CardTitle>
                    <CardDescription>
                        {t("admin.coupons.table.description")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : coupons.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <TagIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>{t("admin.coupons.table.noFound")}</p>
                            <Button variant="outline" className="mt-4" onClick={handleCreate}>
                                {t("admin.coupons.table.createFirst")}
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t("admin.coupons.table.cols.code")}</TableHead>
                                        <TableHead>{t("admin.coupons.table.cols.type")}</TableHead>
                                        <TableHead>{t("admin.coupons.table.cols.discount")}</TableHead>
                                        <TableHead>{t("admin.coupons.table.cols.validUntil")}</TableHead>
                                        <TableHead>{t("admin.coupons.table.cols.usage")}</TableHead>
                                        <TableHead>{t("admin.coupons.table.cols.status")}</TableHead>
                                        <TableHead className="text-right">{t("admin.coupons.table.cols.actions")}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {coupons.map((coupon) => (
                                        <TableRow key={coupon.id}>
                                            <TableCell>
                                                <span className="font-mono font-semibold">
                                                    {coupon.code}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {t(`admin.coupons.filters.types.${coupon.type}`)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {coupon.type === 'free_delivery' ? t("admin.coupons.common.freeShipping") : `${coupon.discount_percentage}%`}
                                            </TableCell>
                                            <TableCell>
                                                <span
                                                    className={
                                                        isExpired(coupon.valid_until)
                                                            ? "text-destructive"
                                                            : ""
                                                    }
                                                >
                                                    {formatDate(coupon.valid_until)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {coupon.usage_count}
                                                {coupon.usage_limit && ` / ${coupon.usage_limit}`}
                                            </TableCell>
                                            <TableCell>
                                                {isExpired(coupon.valid_until) ? (
                                                    <Badge variant="destructive">{t("admin.coupons.status.expired")}</Badge>
                                                ) : coupon.is_active ? (
                                                    <Badge className="bg-green-500">{t("admin.coupons.status.active")}</Badge>
                                                ) : (
                                                    <Badge variant="secondary">{t("admin.coupons.status.inactive")}</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEdit(coupon)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteClick(coupon.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        {t("admin.reviews.pagination.pageInfo", { current: page, total: totalPages })}
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                            {t("admin.reviews.pagination.previous")}
                        </Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>
                            {t("admin.reviews.pagination.next")}
                        </Button>
                    </div>
                </div>
            )}

            {/* Coupon Dialog */}
            <CouponDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                coupon={editingCoupon}
                onSave={handleSave}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("admin.coupons.delete.title")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("admin.coupons.delete.description")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("admin.coupons.delete.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>
                            {t("admin.coupons.delete.confirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
