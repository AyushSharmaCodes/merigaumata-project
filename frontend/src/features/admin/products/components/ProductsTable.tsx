import React from "react";
import { useTranslation } from "react-i18next";
import { Edit, Trash2, ChevronDown, ChevronRight, Truck, RotateCcw } from "lucide-react";
import { cn } from "@/core/utils/utils";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { Button } from "@/shared/components/ui/button";
import { AdminTableSkeleton } from "@/shared/components/ui/page-skeletons";
import { stripHtml } from "@/core/utils/stringUtils";
import { getLocalizedContent } from "@/core/utils/localizationUtils";
import type { Product } from "@/shared/types";

interface ProductsTableProps {
  isLoading: boolean;
  products: Product[];
  categories: any[];
  expandedProducts: Set<string>;
  toggleExpand: (id: string) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  getStockStatus: (inventory?: number) => { label: string; variant: "default" | "destructive" | "secondary" | "outline" };
}

export const ProductsTable = ({
  isLoading,
  products,
  categories,
  expandedProducts,
  toggleExpand,
  onEdit,
  onDelete,
  getStockStatus,
}: ProductsTableProps) => {
  const { t, i18n } = useTranslation();

  if (isLoading) {
    return <AdminTableSkeleton columns={8} />;
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{t("admin.products.noProducts")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>{t("admin.products.table.product")}</TableHead>
            <TableHead>{t("admin.products.table.category")}</TableHead>
            <TableHead>{t("admin.products.table.mrp")}</TableHead>
            <TableHead>{t("admin.products.table.sellingPrice")}</TableHead>
            <TableHead>{t("admin.products.table.config")}</TableHead>
            <TableHead>{t("admin.products.table.inventory")}</TableHead>
            <TableHead>{t("admin.products.table.status")}</TableHead>
            <TableHead className="text-right">{t("admin.products.table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const stockStatus = getStockStatus(product.inventory);
            const isExpanded = expandedProducts.has(product.id);
            const hasVariants = product.variants && product.variants.length > 0;

            return (
              <React.Fragment key={product.id}>
                <TableRow className={cn(isExpanded && "border-b-0")}>
                  <TableCell>
                    {hasVariants && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleExpand(product.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <img
                        src={product.images && product.images.length > 0 ? product.images[0] : '/placeholder-image.jpg'}
                        alt={getLocalizedContent(product, i18n.language, 'title')}
                        loading="lazy"
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div>
                        <p className="font-medium">{getLocalizedContent(product, i18n.language, 'title')}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1 group-hover:line-clamp-none transition-all">
                          {stripHtml(getLocalizedContent(product, i18n.language, 'description'))}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      if (product.category_data) {
                        return getLocalizedContent(product.category_data, i18n.language);
                      }
                      const catName = product.category;
                      const matchedCat = categories.find(c =>
                        c.name === catName ||
                        (c.name_i18n && Object.values(c.name_i18n).includes(catName))
                      );
                      return matchedCat ? getLocalizedContent(matchedCat, i18n.language) : catName;
                    })()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.mrp ? `₹${product.mrp}` : "-"}
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold">₹{product.price}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <RotateCcw className={cn("h-3.5 w-3.5", (product.isReturnable === true || (product as any).is_returnable === true) ? "text-green-600" : "text-muted-foreground opacity-50")} />
                        <span className={cn("text-xs font-medium", (product.isReturnable === true || (product as any).is_returnable === true) ? "text-green-700" : "text-muted-foreground")}>
                          {(product.isReturnable === true || (product as any).is_returnable === true)
                            ? t('admin.products.dialog.return.daysCount', { count: (product.returnDays !== undefined ? product.returnDays : (product as any).return_days) ?? 0 })
                            : t('admin.products.dialog.return.nonReturnableShort')}
                        </span>
                      </div>

                      {product.delivery_config && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 cursor-help">
                                <Truck className="h-3.5 w-3.5 text-orange-600" />
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {product.delivery_config.calculation_type === 'FLAT_PER_ORDER' ? t('admin.products.delivery.flatOrder') :
                                    product.delivery_config.calculation_type === 'PER_ITEM' ? t('admin.products.delivery.perItem') :
                                      product.delivery_config.calculation_type === 'PER_PACKAGE' ? t('admin.products.delivery.perPkg') : t('admin.products.delivery.custom')}
                                  {product.delivery_config.base_delivery_charge > 0 && (
                                    <span className="ml-1 font-medium text-orange-700">(₹{product.delivery_config.base_delivery_charge})</span>
                                  )}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-semibold text-xs">{t('admin.products.delivery.configTitle')}</p>
                              <p className="text-[10px]">{t('admin.products.delivery.typeLabel')}: {product.delivery_config.calculation_type}</p>
                              <p className="text-[10px]">{t('admin.products.delivery.baseChargeLabel')}: ₹{product.delivery_config.base_delivery_charge}</p>
                              {product.delivery_config.calculation_type === 'PER_PACKAGE' && (
                                <p className="text-[10px]">{t('admin.products.delivery.maxItemsLabel')}: {product.delivery_config.max_items_per_package || t('admin.products.delivery.na')}</p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{product.inventory ?? 0} {t('admin.products.table.units')}</span>
                      {hasVariants && (
                        <span className="text-[10px] text-muted-foreground">
                          {t('admin.products.table.variantAcross', { count: product.variants?.length })}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={stockStatus.variant}>
                      {stockStatus.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(product)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isExpanded && hasVariants && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={9} className="p-0">
                      <div className="p-4 pl-12">
                        <Table className="border rounded-md bg-background">
                          <TableHeader className="bg-muted/50">
                            <TableRow>
                              <TableHead className="h-8 py-0">{t("admin.products.table.variant")}</TableHead>
                              <TableHead className="h-8 py-0">{t("admin.products.table.mrp")}</TableHead>
                              <TableHead className="h-8 py-0">{t("admin.products.table.sellingPrice")}</TableHead>
                              <TableHead className="h-8 py-0">{t("admin.products.table.tax")}</TableHead>
                              <TableHead className="h-8 py-0">{t("admin.products.table.stock")}</TableHead>
                              <TableHead className="h-8 py-0">{t("admin.products.table.status")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {product.variants?.map((variant) => {
                              const variantStockStatus = getStockStatus(variant.stock_quantity);
                              return (
                                <TableRow key={variant.id} className="last:border-0">
                                  <TableCell className="py-2">
                                    <div className="flex items-center gap-2">
                                      <img
                                        src={variant.variant_image_url || product.images?.[0] || '/placeholder-image.jpg'}
                                        alt={getLocalizedContent(variant, i18n.language, 'size_label')}
                                        className="w-8 h-8 rounded object-cover border"
                                      />
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium">{getLocalizedContent(variant, i18n.language, 'size_label')}</span>
                                        {variant.is_default && (
                                          <span className="text-[10px] bg-primary/10 text-primary px-1 rounded w-fit">{t('admin.products.table.default')}</span>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2 text-xs text-muted-foreground">₹{variant.mrp}</TableCell>
                                  <TableCell className="py-2">
                                    <span className="text-sm font-medium">₹{variant.selling_price}</span>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <div className="flex flex-col text-[10px]">
                                      <span className="text-blue-700 font-medium">{variant.gst_rate || 0}% {t('admin.products.table.gst')}</span>
                                      {variant.hsn_code && <span className="text-muted-foreground">{t('admin.products.table.hsn')}: {variant.hsn_code}</span>}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2 text-sm">{variant.stock_quantity} {t('admin.products.table.units')}</TableCell>
                                  <TableCell className="py-2">
                                    <Badge variant={variantStockStatus.variant} className="text-[10px] h-5 px-1.5 uppercase">
                                      {variantStockStatus.label.split(' - ')[0]}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
