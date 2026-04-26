import { Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/shared/components/ui/card";
import { StatsSkeleton } from "@/shared/components/ui/page-skeletons";

interface StockAlertsProps {
  isLoading: boolean;
  stats?: {
    outOfStockCount: number;
    criticalStockCount: number;
    lowStockCount: number;
  };
}

export const StockAlerts = ({ isLoading, stats }: StockAlertsProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <StatsSkeleton count={3} />;
  }

  if (!stats) return null;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {stats.outOfStockCount > 0 && (
        <Card className="relative overflow-hidden border-none shadow-lg bg-white group hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500" />
          <CardContent className="pt-6 flex items-center gap-5">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl group-hover:scale-110 transition-transform duration-300">
              <Package className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-red-600/70 uppercase tracking-wider">
                {t("admin.products.stats.outOfStock")}
              </p>
              <p className="text-3xl font-black text-red-700 dark:text-red-300">
                {t("admin.products.stats.productsCount", { count: stats.outOfStockCount })}
              </p>
            </div>
          </CardContent>
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Package className="h-24 w-24 text-red-900" />
          </div>
        </Card>
      )}

      {stats.criticalStockCount > 0 && (
        <Card className="relative overflow-hidden border-none shadow-lg bg-white group hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-orange-500" />
          <CardContent className="pt-6 flex items-center gap-5">
            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-2xl group-hover:scale-110 transition-transform duration-300">
              <Package className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-orange-600/70 uppercase tracking-wider">
                {t("admin.products.stats.criticalStock")}
              </p>
              <p className="text-3xl font-black text-orange-700 dark:text-orange-300">
                {t("admin.products.stats.productsCount", { count: stats.criticalStockCount })}
              </p>
            </div>
          </CardContent>
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Package className="h-24 w-24 text-orange-900" />
          </div>
        </Card>
      )}

      {stats.lowStockCount > 0 && (
        <Card className="relative overflow-hidden border-none shadow-lg bg-white group hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
          <CardContent className="pt-6 flex items-center gap-5">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl group-hover:scale-110 transition-transform duration-300">
              <Package className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-600/70 uppercase tracking-wider">
                {t("admin.products.stats.lowStock")}
              </p>
              <p className="text-3xl font-black text-amber-700 dark:text-amber-300">
                {t("admin.products.stats.productsCount", { count: stats.lowStockCount })}
              </p>
            </div>
          </CardContent>
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Package className="h-24 w-24 text-amber-900" />
          </div>
        </Card>
      )}
    </div>
  );
};
