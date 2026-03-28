import { logger } from "@/lib/logger";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Package, Download, ChevronDown, ChevronRight, Truck, ReceiptText, RotateCcw, Info, Percent } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProductDialog } from "@/components/admin/ProductDialog";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, getErrorDetails } from "@/lib/errorUtils";
import type { Product, VariantFormData, DeliveryConfig } from "@/types";
import { productService } from "@/services/product.service";
import { uploadService } from "@/services/upload.service";
import { deliveryConfigService } from "@/services/delivery-config.service";
import { categoryService } from "@/services/category.service";

import { getLocalizedContent } from "@/utils/localizationUtils";



export default function ProductsManagement() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", searchQuery, page, i18n.language],
    queryFn: async () => {
      return productService.getAll({ page, limit: 15, search: searchQuery, includeStats: true, lang: i18n.language });
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", "all", i18n.language],
    queryFn: async () => categoryService.getAll("product"),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const productMutation = useMutation({
    mutationFn: async (productData: Omit<Partial<Product>, "variants" | "delivery_config"> & { id?: string, imageFiles?: (File | string)[], variants?: VariantFormData[], delivery_config?: Partial<DeliveryConfig> }) => {
      logger.debug("ProductMutation - Received data:", productData);

      const { variants, imageFiles, delivery_config, ...finalProductData } = productData;
      // Defensive ID check: check productData.id OR selectedProduct.id if editing
      const productId = productData.id || selectedProduct?.id;
      const finalProduct = { ...finalProductData, id: productId } as any;
      const newlyUploadedUrls: string[] = [];

      logger.debug("ProductMutation - Final Product Data:", finalProduct);
      logger.debug("ProductMutation - Detected Product ID:", productId);

      try {
        // 1. Handle main product image uploads
        if (imageFiles && imageFiles.length > 0) {
          const processedImages: string[] = [];
          for (const img of imageFiles) {
            if (img instanceof File) {
              const response = await uploadService.uploadImage(img, 'product');
              processedImages.push(response.url);
              newlyUploadedUrls.push(response.url);
            } else if (typeof img === 'string') {
              if (img.startsWith('blob:')) {
                // Blob URLs are for browser previews only - they should not reach here
                // Skip with warning (this indicates a state sync issue that should be investigated)
                logger.warn("Skipping unexpected blob URL in imageFiles - previews should not leak into form data:", img);
              } else {
                // Valid storage URL - pass through unchanged
                processedImages.push(img);
              }
            }
          }
          finalProduct.images = processedImages;
        }

        // 2. Handle variant image uploads
        const processedVariants = variants ? await Promise.all(variants.map(async (v) => {
          const variant = { ...v };
          if (v.imageFile instanceof File) {
            const response = await uploadService.uploadImage(v.imageFile, 'product');
            variant.variant_image_url = response.url;
            newlyUploadedUrls.push(response.url);
          } else if (typeof v.imageFile === 'string') {
            if (v.imageFile.startsWith('blob:')) {
              // Blob URLs are for browser previews only - skip with warning
              logger.warn("Skipping unexpected blob URL in variant imageFile:", v.imageFile);
            } else {
              // Valid storage URL - pass through unchanged
              variant.variant_image_url = v.imageFile;
            }
          }
          delete variant.imageFile;
          return variant;
        })) : undefined;

        let resultProduct: Product;

        // 3. Save product (with or without variants)
        if (finalProduct.id) {
          logger.debug("ProductMutation - Updating product:", finalProduct.id);
          if (processedVariants && processedVariants.length > 0) {
            resultProduct = await productService.updateWithVariants(finalProduct.id, {
              product: {
                ...finalProduct,
                delivery_config: delivery_config && delivery_config.is_active ? delivery_config : undefined
              },
              variants: processedVariants
            });
          } else {
            resultProduct = await productService.update(finalProduct.id, {
              ...finalProduct,
              delivery_config: delivery_config && delivery_config.is_active ? delivery_config : undefined
            });
          }
        } else {
          logger.debug("ProductMutation - Creating new product");
          if (processedVariants && processedVariants.length > 0) {
            resultProduct = await productService.createWithVariants({
              product: { ...finalProduct, createdAt: finalProduct.createdAt || new Date().toISOString(), delivery_config: delivery_config && delivery_config.is_active ? delivery_config : undefined },
              variants: processedVariants
            });
          } else {
            resultProduct = await productService.create(
              { ...finalProduct, createdAt: finalProduct.createdAt || new Date().toISOString(), delivery_config: delivery_config && delivery_config.is_active ? delivery_config : undefined } as Omit<Product, "id">
            );
          }
        }

        return resultProduct;
      } catch (error) {
        // Rollback: Delete newly uploaded images if product saving fails
        if (newlyUploadedUrls.length > 0) {
          logger.warn("Product creation/update failed. Rolling back uploaded images...", newlyUploadedUrls);
          await Promise.allSettled(newlyUploadedUrls.map(url =>
            uploadService.deleteImageByUrl(url).catch(err =>
              logger.error(`Failed to rollback image ${url}:`, err)
            )
          ));
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      const productId = variables.id || data?.id;
      if (productId) {
        queryClient.invalidateQueries({ queryKey: ["product", productId] });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({
        title: t("common.success"),
        description: selectedProduct
          ? t("admin.products.toasts.updateSuccess")
          : t("admin.products.toasts.createSuccess"),
      });
      setProductDialogOpen(false);
      setSelectedProduct(null);
    },
    onError: (error: unknown) => {
      logger.error("Product mutation error:", error);
      const message = getErrorMessage(error, t, "admin.products.toasts.saveError");
      const details = getErrorDetails(error);

      toast({
        title: t("common.error"),
        description: (
          <div className="space-y-1">
            <p>{message}</p>
            {details && details.length > 0 && (
              <ul className="text-xs list-disc pl-4 mt-1 opacity-90">
                {details.map((detail, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">{detail.path.join('.')}:</span> {detail.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {

      // Get the product to access its images
      const product = data?.products?.find(p => p.id === id);
      logger.debug("Deleting product", { id, product });

      // Delete images from Supabase Storage if they exist
      if (product && product.images && product.images.length > 0) {
        logger.debug("Found images to delete:", product.images);

        for (const imageUrl of product.images) {
          try {
            logger.debug("Attempting to delete image:", imageUrl);
            await uploadService.deleteImageByUrl(imageUrl);
            logger.debug("Successfully deleted image:", imageUrl);
          } catch (error) {
            logger.error(`Failed to delete image ${imageUrl}:`, error);
            // Continue with other images even if one fails
          }
        }
      } else {
        logger.debug("No images to delete for this product");
      }

      // Delete VARIANT images if they exist
      if (product && product.variants && product.variants.length > 0) {
        logger.debug("Checking for variant images to delete...");

        for (const variant of product.variants) {
          if (variant.variant_image_url) {
            try {
              logger.debug("Attempting to delete variant image:", variant.variant_image_url);
              await uploadService.deleteImageByUrl(variant.variant_image_url);
              logger.debug("Successfully deleted variant image");
            } catch (error) {
              logger.error(`Failed to delete variant image ${variant.variant_image_url}:`, error);
              // Continue with other images
            }
          }
        }
      }

      // Delete the product
      await productService.delete(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({
        title: t("common.success"),
        description: t("admin.products.toasts.deleteSuccess"),
      });
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
    },
    onError: (error: unknown) => {
      logger.error("Delete mutation error:", error);
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.products.toasts.deleteError"),
        variant: "destructive",
      });
    },
  });

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setProductDialogOpen(true);
  };

  const handleEditProduct = async (product: Product) => {
    try {
      const fullProduct = await productService.getById(product.id, { lang: i18n.language });
      setSelectedProduct(fullProduct);
      setProductDialogOpen(true);
    } catch (error) {
      logger.error("Failed to load full product for editing:", error);
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "admin.products.toasts.loadError"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = (product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  const toggleExpand = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  const handleExport = async () => {
    try {
      toast({
        title: t("admin.products.toasts.exportStartedTitle", "Exporting Data"),
        description: t("admin.products.toasts.exportStartedDesc", "Fetching all product details. Please wait..."),
      });

      // Use native fetch — Axios's responseType: 'blob' produces blobs that
      // Chrome on macOS doesn't respect the download attribute for
      const { CONFIG } = await import('@/config');
      const response = await fetch(`${CONFIG.API_BASE_URL}/products/export`, {
        credentials: 'include',
        headers: {
          'x-user-lang': i18n.language,
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      const dateStr = new Date().toISOString().split('T')[0];
      let filename = `products_all_details_${dateStr}.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch?.[1]) {
          filename = filenameMatch[1];
        }
      }

      // Get the response as a proper blob and trigger download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 5000);

      toast({
        title: t("admin.products.toasts.exportSuccess", "Export Successful"),
        description: t("admin.products.toasts.exportDesc", "Detailed product CSV has been generated."),
      });
    } catch (error) {
      logger.error("Failed to export products:", error);
      toast({
        title: t("common.error"),
        description: t("admin.products.toasts.exportError", "Failed to export data. Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleSaveProduct = (product: Omit<Partial<Product>, "variants" | "delivery_config"> & { imageFiles?: (File | string)[], variants?: VariantFormData[], delivery_config?: Partial<DeliveryConfig> }) => {
    productMutation.mutate(product);
  };

  const handleConfirmDelete = () => {
    if (selectedProduct) {
      deleteMutation.mutate(selectedProduct.id);
    }
  };

  const getStockStatus = (inventory?: number) => {
    if (!inventory || inventory === 0)
      return { label: t("admin.products.stockStatus.soldOut"), variant: "destructive" as const };
    if (inventory < 15)
      return {
        label: t("admin.products.stockStatus.critical", { count: inventory }),
        variant: "destructive" as const,
      };
    if (inventory < 50)
      return {
        label: t("admin.products.stockStatus.low", { count: inventory }),
        variant: "secondary" as const,
      };
    return { label: t("admin.products.stockStatus.inStock"), variant: "default" as const };
  };



  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          {t("admin.products.title")}
        </h2>
        <p className="text-muted-foreground">
          {t("admin.products.subtitle")}
        </p>
      </div>

      {/* Stock Alerts */}
      {data?.stats && (
        <div className="grid gap-4 md:grid-cols-3">
          {data.stats.outOfStockCount > 0 && (
            <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full">
                  <Package className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {t("admin.products.stats.outOfStock")}
                  </p>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {t("admin.products.stats.productsCount", { count: data.stats.outOfStockCount })}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {data.stats.criticalStockCount > 0 && (
            <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/50">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-full">
                  <Package className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    {t("admin.products.stats.criticalStock")}
                  </p>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                    {t("admin.products.stats.productsCount", { count: data.stats.criticalStockCount })}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {data.stats.lowStockCount > 0 && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full">
                  <Package className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    {t("admin.products.stats.lowStock")}
                  </p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                    {t("admin.products.stats.productsCount", { count: data.stats.lowStockCount })}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("admin.products.allProducts")} ({data?.total || 0})
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="product-search"
                  name="search"
                  placeholder={t("admin.products.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1); // Reset to page 1 on search
                  }}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                {t("admin.products.export")}
              </Button>
              <Button onClick={handleAddProduct}>
                <Plus className="h-4 w-4 mr-2" />
                {t("admin.products.addProduct")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">{t("admin.products.loading")}</div>
          ) : !data?.products || data.products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("admin.products.noProducts")}</p>
            </div>
          ) : (
            <>
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
                    {(data?.products || []).map((product) => {
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
                                  <p className="text-sm text-muted-foreground truncate max-w-xs">
                                    {getLocalizedContent(product, i18n.language, 'description')}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                // 1. Try joined data (Most robust)
                                if (product.category_data) {
                                  return getLocalizedContent(product.category_data, i18n.language);
                                }

                                // 2. Fallback: Lookup by string (Backward compatibility)
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
                              <div className="flex flex-col">
                                <span className="font-semibold">₹{product.price}</span>

                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {/* Returnability */}
                                <div className="flex items-center gap-1.5">
                                  <RotateCcw className={cn("h-3.5 w-3.5", (product.isReturnable === true || (product as any).is_returnable === true) ? "text-green-600" : "text-muted-foreground opacity-50")} />
                                  <span className={cn("text-xs font-medium", (product.isReturnable === true || (product as any).is_returnable === true) ? "text-green-700" : "text-muted-foreground")}>
                                    {(product.isReturnable === true || (product as any).is_returnable === true)
                                      ? t('admin.products.dialog.return.daysCount', { count: (product.returnDays !== undefined ? product.returnDays : (product as any).return_days) ?? 0 })
                                      : t('admin.products.dialog.return.nonReturnableShort')}
                                  </span>
                                </div>

                                {/* Delivery */}
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
                                  onClick={() => handleEditProduct(product)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(product)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && hasVariants && (
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={8} className="p-0">
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

              {/* Pagination Controls */}
              <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                  {t('admin.products.pagination.showing', {
                    start: (page - 1) * 15 + 1,
                    end: Math.min(page * 15, data.total),
                    total: data.total
                  })}
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    {t('admin.products.pagination.previous')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * 15 >= data.total}
                  >
                    {t('admin.products.pagination.next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProduct}
        onSave={(data) => {
          logger.debug("ProductsManagement - onSave triggered with data:", data);
          productMutation.mutate(data);
        }}
        isSaving={productMutation.isPending}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("admin.products.deleteDialog.title")}
        description={t("admin.products.deleteDialog.desc", { title: selectedProduct ? getLocalizedContent(selectedProduct, i18n.language, 'title') : "" })}
        onConfirm={() => selectedProduct && deleteMutation.mutate(selectedProduct.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
