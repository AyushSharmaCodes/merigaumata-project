import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Clock, Package, XCircle, RotateCcw, Undo2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { subscribeToRealtime } from "@/lib/realtime-client";

interface OrderStatsCardsProps {
  onFilterChange: (status: string) => void;
  activeStatus: string;
}

export function OrderStatsCards({ onFilterChange, activeStatus }: OrderStatsCardsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-orders-stats"],
    queryFn: async () => {
      const response = await apiClient.get("/orders/stats/summary");
      return response.data;
    },
    staleTime: 30000,
  });

  useEffect(() => {
    const unsubscribe = subscribeToRealtime(["dashboard"], () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders-stats"] });
    });

    return unsubscribe;
  }, [queryClient]);

  const cards = [
    {
      title: t("admin.orders.stats.total", "Total Orders"),
      value: stats?.data?.totalOrders || 0,
      icon: ShoppingCart,
      color: "text-blue-600",
      bg: "bg-blue-100",
      status: "all",
    },
    {
      title: t("admin.orders.stats.new", "New Orders"),
      value: stats?.data?.newOrders || 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-100",
      status: "pending,confirmed",
    },
    {
      title: t("admin.orders.stats.processing", "Orders in Process"),
      value: stats?.data?.processingOrders || 0,
      icon: Package,
      color: "text-indigo-600",
      bg: "bg-indigo-100",
      status: "processing,packed,shipped,out_for_delivery,return_approved,return_picked_up",
    },
    {
      title: t("admin.orders.stats.cancelled", "Cancelled Orders"),
      value: stats?.data?.cancelledOrders || 0,
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50",
      status: "cancelled_flow",
    },
    {
      title: t("admin.orders.stats.returned", "Partial | Full Returned Orders"),
      value: stats?.data?.returnedOrders || 0,
      icon: Undo2,
      color: "text-purple-600",
      bg: "bg-purple-50",
      status: "returned_flow",
    },
    {
      title: t("admin.orders.stats.returnRequested", "Return Requests"),
      value: stats?.data?.returnRequestedOrders || 0,
      icon: RotateCcw,
      color: "text-fuchsia-600",
      bg: "bg-fuchsia-100",
      status: "return_requested",
    },
    {
      title: t("admin.orders.stats.failed", "Failed Orders"),
      value: stats?.data?.failedOrders || 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50",
      status: "failed_flow",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 mb-6">
      {cards.map((card, index) => {
        const isActive = activeStatus === card.status || (card.status === "all" && activeStatus === "all");
        return (
          <Card
            key={index}
            className={`cursor-pointer transition-all hover:shadow-md ${isActive ? 'ring-2 ring-primary border-primary' : ''}`}
            onClick={() => onFilterChange(card.status)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-bold">{card.value}</div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
