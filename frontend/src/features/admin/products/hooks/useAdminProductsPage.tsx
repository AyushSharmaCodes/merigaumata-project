import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/shared/hooks/use-toast";
import { getErrorMessage, getErrorDetails } from "@/core/utils/errorUtils";
import { logger } from "@/core/observability/logger";
import { getProductUploadFolder } from "@/core/upload/upload-utils";
import { uploadService } from "@/core/upload/upload-client";
import { productService } from "@/domains/product";
import { categoryService } from "@/domains/settings";
import { apiClient } from "@/core/api/api-client";
import type { Product, VariantFormData, DeliveryConfig } from "@/shared/types";

export function useAdminProductsPage() {
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
    meta: { blocking: true },
    mutationFn: async (productData: Omit<Partial<Product>, "variants" | "delivery_config"> & {
      id?: string,
      imageFiles?: (File | string)[],
      variants?: VariantFormData[],
      delivery_config?: Partial<DeliveryConfig>,
      removed_image_urls?: string[],
      removed_variant_image_urls?: string[]
    }) => {
      logger.debug("ProductMutation - Received data:", productData);

      const {
        variants,
        imageFiles,
        delivery_config,
        removed_image_urls,
        removed_variant_image_urls,
        ...finalProductData
      } = productData;
      const productId = productData.id || selectedProduct?.id;
      const finalProduct = { ...finalProductData, id: productId } as any;
      const newlyUploadedUrls: string[] = [];
      const productFolder = getProductUploadFolder({
        title: finalProduct.title || selectedProduct?.title,
        title_i18n: finalProduct.title_i18n || selectedProduct?.title_i18n
      });

      try {
        if (imageFiles && imageFiles.length > 0) {
          const processedImages: string[] = [];
          for (const img of imageFiles) {
            if (img instanceof File) {
              const response = await uploadService.uploadImage(img, 'product', productFolder);
              processedImages.push(response.url);
              newlyUploadedUrls.push(response.url);
            } else if (typeof img === 'string') {
              if (img.startsWith('blob:')) {
                logger.warn("Skipping unexpected blob URL in imageFiles:", img);
              } else {
                processedImages.push(img);
              }
            }
          }
          finalProduct.images = processedImages;
        }

        const processedVariants = variants ? await Promise.all(variants.map(async (v) => {
          const variant = { ...v };
          if (v.imageFile instanceof File) {
            const response = await uploadService.uploadImage(v.imageFile, 'product', productFolder);
            variant.variant_image_url = response.url;
            newlyUploadedUrls.push(response.url);
          } else if (typeof v.imageFile === 'string') {
            if (v.imageFile.startsWith('blob:')) {
              logger.warn("Skipping unexpected blob URL in variant imageFile:", v.imageFile);
            } else {
              variant.variant_image_url = v.imageFile;
            }
          }
          delete variant.imageFile;
          return variant;
        })) : undefined;

        let resultProduct: Product;

        if (finalProduct.id) {
          if (processedVariants && processedVariants.length > 0) {
            resultProduct = await productService.updateWithVariants(finalProduct.id, {
              product: {
                ...finalProduct,
                delivery_config
              },
              variants: processedVariants
            });
          } else {
            resultProduct = await productService.update(finalProduct.id, {
              ...finalProduct,
              delivery_config
            });
          }
        } else {
          if (processedVariants && processedVariants.length > 0) {
            resultProduct = await productService.createWithVariants({
              product: { ...finalProduct, createdAt: finalProduct.createdAt || new Date().toISOString(), delivery_config },
              variants: processedVariants
            });
          } else {
            resultProduct = await productService.create(
              { ...finalProduct, createdAt: finalProduct.createdAt || new Date().toISOString(), delivery_config } as Omit<Product, "id">
            );
          }
        }

        return resultProduct;
      } catch (error) {
        if (newlyUploadedUrls.length > 0) {
          logger.warn("Rolling back uploaded images...", newlyUploadedUrls);
          await Promise.allSettled(newlyUploadedUrls.map(url =>
            uploadService.deleteImageByUrl(url).catch(err =>
              logger.error(`Failed to rollback image ${url}:`, err)
            )
          ));
        }
        throw error;
      }
    },
    onSuccess: async (data, variables) => {
      const removedUrls = [
        ...(variables.removed_image_urls || []),
        ...(variables.removed_variant_image_urls || [])
      ];

      if (removedUrls.length > 0) {
        await Promise.allSettled(removedUrls.map((url) =>
          uploadService.deleteImageByUrl(url).catch((cleanupError) =>
            logger.error("Failed to cleanup replaced product image", { cleanupError, url })
          )
        ));
      }

      const productId = variables.id || data?.id;
      if (productId) {
        await queryClient.invalidateQueries({ queryKey: ["product", productId], exact: false });
        await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
        await queryClient.invalidateQueries({ queryKey: ["product", "list"] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      }
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
                {details.map((detail: any, idx: number) => (
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
    meta: { blocking: true },
    mutationFn: async (id: string) => {
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

      const response = await apiClient.get('/products/export', {
        responseType: 'blob',
        headers: {
          'x-user-lang': i18n.language,
        },
      });

      const contentDisposition = response.headers['content-disposition'];
      const dateStr = new Date().toISOString().split('T')[0];
      let filename = `products_all_details_${dateStr}.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch?.[1]) {
          filename = filenameMatch[1];
        }
      }

      const blob = new Blob([response.data], { type: response.headers['content-type'] });
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

  const handleSaveProduct = (product: any) => {
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

  return {
    t,
    i18n,
    searchQuery,
    setSearchQuery,
    page,
    setPage,
    productDialogOpen,
    setProductDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    selectedProduct,
    expandedProducts,
    data,
    isLoading,
    categories,
    productMutation,
    deleteMutation,
    handleAddProduct,
    handleEditProduct,
    handleDelete,
    toggleExpand,
    handleExport,
    handleSaveProduct,
    handleConfirmDelete,
    getStockStatus,
  };
}
