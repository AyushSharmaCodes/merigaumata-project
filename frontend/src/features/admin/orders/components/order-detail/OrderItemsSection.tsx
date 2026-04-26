import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Package } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/components/ui/table";
import { TranslatedText } from "@/shared/components/ui/TranslatedText";
import type { OrderItem } from "@/shared/types";

interface OrderItemsSectionProps {
    items: OrderItem[];
}

export const OrderItemsSection = memo(({
    items
}: OrderItemsSectionProps) => {
    const { t, i18n } = useTranslation();

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    };

    return (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                        <Package className="h-4 w-4 text-primary" />
                        {t("admin.orders.detail.orderItems.title", "Order Items")}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-slate-200/50 text-slate-600 border-none text-[10px] font-bold">
                        {items.length} {t("admin.orders.detail.orderItems.itemsCount", "Items")}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-slate-100 bg-slate-50/30">
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3 pl-6">
                                {t("admin.orders.detail.orderItems.productDetails", "Product Details")}
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3 text-center">
                                {t("admin.orders.detail.orderItems.hsnSku", "HSN / SKU")}
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3 text-right">
                                {t("admin.orders.detail.orderItems.price", "Price")}
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3 text-center">
                                {t("admin.orders.detail.orderItems.qty", "Qty")}
                            </TableHead>
                            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-slate-400 py-3 text-right pr-6">
                                {t("admin.orders.detail.orderItems.total", "Total")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item: any, index: number) => {
                            const lang = i18n.language;
                            const sizeLabel = item.variant_snapshot?.size_label_i18n?.[lang] || item.variant?.size_label_i18n?.[lang] || item.variant_snapshot?.size_label || item.variant?.size_label || item.size_label;
                            const sizeValue = item.variant_snapshot?.size_value || item.variant?.size_value;
                            const unit = item.variant_snapshot?.unit || item.variant?.unit;
                            const sku = item.variant_snapshot?.sku || item.variant?.sku;
                            const hsn = item.hsn_code || t("common.notAvailable", "N/A");

                            const displayImage = item.variant_snapshot?.variant_image_url || item.variant?.variant_image_url || (item as any).product_variants?.variant_image_url || item.product?.images?.[0] || (item as any).products?.images?.[0];
                            const itemTitle = item.title || item.product?.title || t("admin.orders.detail.common.product");

                            const unitPrice = item.price_per_unit || item.price || 0;
                            const totalPrice = (item.quantity || 1) * unitPrice;

                            const isReturnable = item.is_returnable ?? item.product_snapshot?.is_returnable ?? item.product?.is_returnable ?? item.product?.isReturnable ?? false;
                            const returnDays = item.product_snapshot?.return_days ?? item.product_snapshot?.returnDays ?? item.product?.return_days ?? item.product?.returnDays ?? 0;


                            return (
                                <TableRow key={index} className="border-slate-100 group">
                                    <TableCell className="py-4 pl-6">
                                        <div className="flex gap-4 items-center">
                                            <div className="relative w-12 h-12 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 flex-shrink-0 group-hover:border-primary/20 transition-colors">
                                                {displayImage ? (
                                                    <img
                                                        src={displayImage}
                                                        alt={itemTitle}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                        <Package size={20} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-0.5">
                                                <h4 className="text-sm font-bold text-slate-700 leading-tight">
                                                    <TranslatedText text={itemTitle} />
                                                </h4>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    {sizeLabel && (
                                                        <Badge variant="outline" className="text-[9px] h-4 font-bold border-slate-200 text-slate-500 bg-slate-50/50">
                                                            {sizeValue && `${sizeValue} ${unit} - `}
                                                            {sizeLabel}
                                                        </Badge>
                                                    )}
                                                    {item.variant_snapshot?.sku && (
                                                        <span className="text-[9px] text-slate-400 font-mono">
                                                            #{item.variant_snapshot.sku}
                                                        </span>
                                                    )}
                                                    {isReturnable ? (
                                                        <Badge variant="outline" className="text-[9px] h-4 font-bold border-green-200 text-green-600 bg-green-50">
                                                            {t("admin.orders.detail.orderItems.returnable", "Returnable")}
                                                            {returnDays > 0 && ` (${returnDays} ${t("common.days", "days")})`}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[9px] h-4 font-bold border-red-200 text-red-600 bg-red-50">
                                                            {t("admin.orders.detail.orderItems.nonReturnable", "Non-returnable")}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                       <div className="flex flex-col items-center gap-1">
                                            <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded leading-none">
                                                {hsn}
                                            </span>
                                            {sku && (
                                                <span className="text-[9px] text-slate-400 font-medium">
                                                    {t("admin.orders.detail.orderItems.sku", "SKU")}: {sku}
                                                </span>
                                            )}
                                       </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end gap-0.5">
                                            <span className="text-xs font-bold text-slate-700">{formatCurrency(unitPrice)}</span>
                                            <span className="text-[9px] text-slate-400 lowercase">
                                                {(item.product?.price_includes_tax ?? item.product?.default_price_includes_tax ?? true) ? t("admin.orders.detail.orderItems.incTax", "Incl. Tax") : t("admin.orders.detail.orderItems.excTax", "Excl. Tax")}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-slate-600 text-sm">
                                        {item.quantity}
                                    </TableCell>
                                    <TableCell className="text-right pr-6 font-black text-slate-800 text-sm">
                                        {formatCurrency(totalPrice)}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
});

OrderItemsSection.displayName = "OrderItemsSection";
