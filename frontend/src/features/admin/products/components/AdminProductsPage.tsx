import { useAdminProductsPage } from "../hooks/useAdminProductsPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Package } from "lucide-react";
import { ProductDialog } from "@/features/admin/products";
import { DeleteConfirmDialog } from "@/features/admin";
import { getLocalizedContent } from "@/core/utils/localizationUtils";
import { StockAlerts } from "./StockAlerts";
import { ProductsHeader } from "./ProductsHeader";
import { ProductsTable } from "./ProductsTable";

export function AdminProductsPage() {

  const controller = useAdminProductsPage();
  const {
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
    getStockStatus,
  } = controller;

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

      <StockAlerts isLoading={isLoading} stats={data?.stats} />

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("admin.products.allProducts")} ({data?.total || 0})
            </CardTitle>
            <ProductsHeader
              searchQuery={searchQuery}
              onSearchChange={(val) => {
                setSearchQuery(val);
                setPage(1);
              }}
              onAddProduct={handleAddProduct}
              onExport={handleExport}
            />
          </div>
        </CardHeader>
        <CardContent>
          <ProductsTable
            isLoading={isLoading}
            products={data?.products || []}
            categories={categories}
            expandedProducts={expandedProducts}
            toggleExpand={toggleExpand}
            onEdit={handleEditProduct}
            onDelete={handleDelete}
            getStockStatus={getStockStatus}
          />

          {/* Pagination Controls */}
          {data && data.total > 0 && (
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
          )}
        </CardContent>
      </Card>

      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={selectedProduct}
        onSave={handleSaveProduct}
        isLoading={productMutation.isPending}
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
