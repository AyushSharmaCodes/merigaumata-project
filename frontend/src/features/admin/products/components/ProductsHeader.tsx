import { Download, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";

interface ProductsHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onAddProduct: () => void;
  onExport: () => void;
}

export const ProductsHeader = ({
  searchQuery,
  onSearchChange,
  onAddProduct,
  onExport,
}: ProductsHeaderProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex flex-col sm:flex-row gap-2 flex-1 md:justify-end">
        <div className="relative flex-1 sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="product-search"
            name="search"
            placeholder={t("admin.products.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={onExport}>
          <Download className="h-4 w-4 mr-2" />
          {t("admin.products.export")}
        </Button>
        <Button onClick={onAddProduct}>
          <Plus className="h-4 w-4 mr-2" />
          {t("admin.products.addProduct")}
        </Button>
      </div>
    </div>
  );
};
