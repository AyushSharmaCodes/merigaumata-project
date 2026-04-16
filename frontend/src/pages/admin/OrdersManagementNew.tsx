import { logger } from "@/lib/logger";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Order, Product, ReturnRequest } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ShoppingCart,
  Search,
  Eye,
  Download,
  RotateCcw,
  X as XIcon,
  Package,
  Clock,
  CreditCard,
  Filter,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { OrderStatus } from "@/types";
import { usePortalPath } from "@/hooks/usePortalPath";
import { downloadCSV, flattenObject } from "@/lib/exportUtils";
import { getErrorMessage } from "@/lib/errorUtils";
import { apiClient } from "@/lib/api-client";
import { useUIStore } from "@/store/uiStore";
import { OrderStatsCards } from "@/components/admin/OrderStatsCards";
import { AdminTableSkeleton } from "@/components/ui/page-skeletons";

interface ReturnItem {
  id: string;
  quantity: number;
  order_items?: {
    title: string;
    price_per_unit: number;
  };
}

export default function OrdersManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { basePath } = usePortalPath();
  const setBlocking = useUIStore(state => state.setBlocking);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus | "">("");
  const [activeReturnRequest, setActiveReturnRequest] = useState<ReturnRequest | null>(null);
  const [returnDetailsLoading, setReturnDetailsLoading] = useState(false);

  // Pagination and filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [paymentFilter, setPaymentFilter] = useState(searchParams.get("paymentStatus") || "all");
  const initialLoadDone = useRef(false);
  const ITEMS_PER_PAGE = 10;

  const queryClient = useQueryClient();

  // Sync filters with URL on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      const urlStatus = searchParams.get("status");
      const urlPayment = searchParams.get("paymentStatus");
      if (urlStatus && urlStatus !== statusFilter) setStatusFilter(urlStatus);
      if (urlPayment && urlPayment !== paymentFilter) setPaymentFilter(urlPayment);
      initialLoadDone.current = true;
    }
  }, [searchParams, statusFilter, paymentFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, paymentFilter]);

  const { data: ordersResponse, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-orders", currentPage, searchQuery, statusFilter, paymentFilter],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        all: 'true'
      };

      if (searchQuery) params.orderNumber = searchQuery;

      // If a specific status filter is set via dropdown or cards, use it.
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      if (paymentFilter !== 'all') params.payment_status = paymentFilter;

      const response = await apiClient.get("/orders", { params });
      return response.data;
    },
    staleTime: 30000, 
    refetchInterval: 30000, // Live updates every 30 seconds
    placeholderData: keepPreviousData,
  });

  const allOrders = ordersResponse?.data || [];

  // Update pagination meta
  useEffect(() => {
    if (ordersResponse?.meta) {
      setTotalOrders(ordersResponse.meta.total || 0);
      setTotalPages(ordersResponse.meta.totalPages || 1);
    }
  }, [ordersResponse]);



  const updateStatusMutation = useMutation({
    meta: { blocking: true },
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: OrderStatus;
    }) => {
      await apiClient.put(`/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-stats"] });
      toast({
        title: t("common.success"),
        description: t("admin.orders.toasts.updateSuccess"),
      });
      setStatusDialogOpen(false);
      setNewStatus("");
    },
    onError: () => {
      toast({
        title: t("common.error"),
        description: t("admin.orders.toasts.updateFailed"),
        variant: "destructive",
      });
    },
  });

  const handleStatusUpdate = async () => {
    if (selectedOrder && newStatus) {
      // Special logic for Return Approval/Rejection
      if (
        (newStatus === 'return_approved' || newStatus === 'return_rejected') &&
        activeReturnRequest
      ) {
        setBlocking(true);
        try {
          if (newStatus === 'return_approved') {
            await apiClient.post(`/returns/${activeReturnRequest.id}/approve`, {});
            toast({
              title: t("common.success"),
              description: t("admin.orders.toasts.returnApproved"),
            });
          } else {
            await apiClient.post(`/returns/${activeReturnRequest.id}/reject`, { reason: "Rejected by admin" });
            toast({
              title: t("common.success"),
              description: t("admin.orders.toasts.returnRejected"),
            });
          }
          queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
          queryClient.invalidateQueries({ queryKey: ["admin-orders-stats"] });
          setStatusDialogOpen(false);
          setNewStatus("");
          setActiveReturnRequest(null);
          return;
        } catch (error: unknown) {
          toast({
            title: t("common.error"),
            description: getErrorMessage(error, t, ("admin.orders.toasts.returnActionFailed")),
            variant: "destructive",
          });
          return;
        } finally {
          setBlocking(false);
        }
      }

      updateStatusMutation.mutate({
        orderId: selectedOrder.id,
        status: newStatus as OrderStatus,
      });
    }
  };

  const fetchReturnDetails = async (orderId: string) => {
    setReturnDetailsLoading(true);
    try {
      const response = await apiClient.get(`/returns/orders/${orderId}/active`);
      setActiveReturnRequest(response.data);
    } catch (error) {
      logger.error("Failed to fetch return details", error);
      setActiveReturnRequest(null);
    } finally {
      setReturnDetailsLoading(false);
    }
  };

  const handleExport = (orders: Order[], filename: string) => {
    if (orders.length === 0) {
      toast({
        title: t("common.error"),
        description: t("admin.orders.export.noData", { defaultValue: "No orders to export" }),
        variant: "destructive",
      });
      return;
    }

    const exportData = orders.map((order) =>
      flattenObject({
        id: order.id,
        userId: order.userId,
        status: order.status,
        paymentStatus: order.paymentStatus || order.payment_status,
        total: order.total,
        itemCount: order.items.length,
        createdAt: format(new Date(order.createdAt || order.created_at), "yyyy-MM-dd HH:mm:ss"),
        shippingCity: order.shippingAddress?.city || order.shipping_address?.city || 'N/A',
        shippingState: order.shippingAddress?.state || order.shipping_address?.state || 'N/A',
      })
    );

    downloadCSV(exportData, filename);
    toast({
      title: t("common.success"),
      description: t("admin.orders.export.success", { defaultValue: "Orders exported successfully" }),
    });
  };

  const getStatusBadge = (status: OrderStatus) => {
    const statusConfig: Record<
      OrderStatus,
      { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
    > = {
      // Normal Flow
      pending: {
        label: t("admin.orders.status.pending"),
        variant: "outline",
        className: "bg-gray-100 text-gray-800",
      },
      confirmed: {
        label: t("admin.orders.status.confirmed"),
        variant: "default",
        className: "bg-yellow-500 text-white",
      },
      processing: {
        label: t("admin.orders.status.processing"),
        variant: "secondary",
        className: "bg-blue-400 text-white",
      },
      packed: {
        label: t("admin.orders.status.packed"),
        variant: "default",
        className: "bg-blue-500 text-white",
      },
      shipped: {
        label: t("admin.orders.status.shipped"),
        variant: "default",
        className: "bg-blue-600 text-white",
      },
      out_for_delivery: {
        label: t("admin.orders.status.outForDelivery"),
        variant: "default",
        className: "bg-indigo-500 text-white",
      },
      delivered: {
        label: t("admin.orders.status.delivered"),
        variant: "default",
        className: "bg-green-500 text-white",
      },
      // Cancellation & Refund
      cancelled: {
        label: t("admin.orders.status.cancelled"),
        variant: "destructive",
        className: "bg-red-500 text-white",
      },
      refunded: {
        label: t("admin.orders.status.refunded"),
        variant: "default",
        className: "bg-green-400 text-white",
      },
      // Return Flow
      return_requested: {
        label: t("admin.orders.status.returnRequested"),
        variant: "default",
        className: "bg-purple-400 text-white",
      },
      return_approved: {
        label: t("admin.orders.status.returnApproved"),
        variant: "default",
        className: "bg-purple-600 text-white",
      },
      return_picked_up: {
        label: t("admin.orders.status.returnPickedUp", "Return Picked Up"),
        variant: "default",
        className: "bg-purple-500 text-white",
      },
      return_rejected: {
        label: t("admin.orders.status.returnRejected"),
        variant: "destructive",
        className: "bg-red-400 text-white",
      },
      returned: {
        label: t("admin.orders.status.returned"),
        variant: "default",
        className: "bg-purple-700 text-white",
      },
      partially_returned: {
        label: t("admin.orders.status.partially_returned"),
        variant: "default",
        className: "bg-purple-500 text-white",
      },
      partially_refunded: {
        label: t("admin.orders.status.partially_refunded"),
        variant: "default",
        className: "bg-teal-500 text-white",
      },
      delivery_unsuccessful: {
        label: t("admin.orders.status.delivery_unsuccessful"),
        variant: "default",
        className: "bg-orange-600 text-white",
      },
    };

    const config = statusConfig[status] || {
      label: status,
      variant: "outline",
      className: "bg-gray-100 text-gray-800",
    };

    return (
      <Badge className={config.className} variant={config.variant}>
        {t(`admin.orders.status.${status}`, config.label)}
      </Badge>
    );
  };

  const getNextStatuses = (currentStatus: OrderStatus): OrderStatus[] => {
    // Based on history.service.js ALLOWED_TRANSITIONS
    const statusFlows: Record<OrderStatus, OrderStatus[]> = {
      // Normal Flow
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["packed", "cancelled"],
      packed: ["shipped", "cancelled"],
      shipped: ["out_for_delivery"],
      out_for_delivery: ["delivered", "returned"],
      delivered: ["return_requested"],
      // Cancellation & Refund
      cancelled: ["refunded"],
      refunded: [],
      // Return Flow
      return_requested: ["return_approved", "return_rejected"],
      return_approved: ["return_picked_up"],
      return_picked_up: ["returned", "partially_returned"],
      return_rejected: [],
      returned: ["refunded"],
      partially_returned: ["returned"],
      partially_refunded: ["refunded"],
      delivery_unsuccessful: ["returned"],
    };

    return statusFlows[currentStatus] || [];
  };

  const OrdersTable = ({ orders }: { orders: Order[] }) => (
    <div className="overflow-x-auto">
      {orders.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t("admin.orders.empty")}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("admin.orders.table.id")}</TableHead>
              <TableHead>{t("admin.orders.table.date")}</TableHead>
              <TableHead>{t("admin.orders.table.customer")}</TableHead>
              <TableHead>{t("admin.orders.table.items")}</TableHead>
              <TableHead>{t("admin.orders.table.total")}</TableHead>
              <TableHead>{t("admin.orders.table.status")}</TableHead>
              <TableHead>{t("admin.orders.table.payment")}</TableHead>
              <TableHead className="text-right">{t("admin.orders.table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium font-mono text-xs">{order.order_number || order.id}</TableCell>
                <TableCell>
                  {format(new Date(order.createdAt || order.created_at || Date.now()), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{order.customer_name || t("admin.orders.table.guest")}</span>
                    <span className="text-xs text-muted-foreground">{order.customer_email}</span>
                  </div>
                </TableCell>
                <TableCell>{order.items?.length || 0} items</TableCell>
                <TableCell className="font-medium">₹{(order.total || order.total_amount || 0).toFixed(2)}</TableCell>
                <TableCell>{getStatusBadge(order.status)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      (order.paymentStatus || order.payment_status) === "paid"
                        ? "default"
                        : (order.paymentStatus || order.payment_status) === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {(() => {
                      const rawStatus = order.paymentStatus || order.payment_status || "pending";
                      const normalized = rawStatus.toLowerCase().replace('status.', '').trim().replace(/ /g, '_');
                      return t(`admin.orders.status.${normalized}`, rawStatus);
                    })()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`${basePath}/orders/${order.id}`)}
                    title={t("admin.orders.toasts.viewOrderDetails")}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
      }
    </div >
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">{t("admin.orders.title")}</h2>
          <p className="text-muted-foreground">
            {t("admin.orders.subtitle")}
          </p>
        </div>
      </div>

      <OrderStatsCards 
        activeStatus={statusFilter}
        onFilterChange={(status) => {
          setStatusFilter(status);
        }} 
      />

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="order-admin-search"
            name="search"
            placeholder={t("admin.orders.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder={t("admin.orders.filterStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.orders.filterStatus")}</SelectItem>
            <SelectItem value="pending,confirmed">{t("admin.orders.stats.new", "New Orders")}</SelectItem>
            <SelectItem value="processing,packed,shipped,out_for_delivery,return_approved,return_picked_up">{t("admin.orders.stats.processing", "Orders in Process")}</SelectItem>
            <SelectItem value="cancelled_flow">{t("admin.orders.stats.cancelled", "Cancelled Orders")}</SelectItem>
            <SelectItem value="returned_flow">{t("admin.orders.stats.returned", "Returned Orders")}</SelectItem>
            <SelectItem value="failed_flow">{t("admin.orders.stats.failed", "Failed Orders")}</SelectItem>
            {/* Normal Flow */}
            <SelectItem value="pending">{t("admin.orders.status.pending")}</SelectItem>
            <SelectItem value="confirmed">{t("admin.orders.status.confirmed")}</SelectItem>
            <SelectItem value="processing">{t("admin.orders.status.processing")}</SelectItem>
            <SelectItem value="packed">{t("admin.orders.status.packed")}</SelectItem>
            <SelectItem value="shipped">{t("admin.orders.status.shipped")}</SelectItem>
            <SelectItem value="out_for_delivery">{t("admin.orders.status.outForDelivery")}</SelectItem>
            <SelectItem value="delivered">{t("admin.orders.status.delivered")}</SelectItem>
            {/* Cancellation & Refund */}
            <SelectItem value="cancelled">{t("admin.orders.status.cancelled")}</SelectItem>
            <SelectItem value="refunded">{t("admin.orders.status.refunded")}</SelectItem>
            {/* Returns */}
            <SelectItem value="return_requested">{t("admin.orders.status.returnRequested")}</SelectItem>
            <SelectItem value="return_approved">{t("admin.orders.status.returnApproved")}</SelectItem>
            <SelectItem value="return_rejected">{t("admin.orders.status.returnRejected")}</SelectItem>
            <SelectItem value="returned">{t("admin.orders.status.returned")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[180px]">
            <CreditCard className="mr-2 h-4 w-4" />
            <SelectValue placeholder={t("admin.orders.filterPayment")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.orders.filterPayment")}</SelectItem>
            <SelectItem value="pending">{t("admin.orders.status.pending")}</SelectItem>
            <SelectItem value="paid">{t("admin.orders.status.paid")}</SelectItem>
            <SelectItem value="failed">{t("admin.orders.status.failed")}</SelectItem>
            <SelectItem value="refund_initiated">{t("admin.orders.status.refundInitiated")}</SelectItem>
            <SelectItem value="refund_in_progress">{t("admin.orders.status.refundInProgress")}</SelectItem>
            <SelectItem value="refunded">{t("admin.orders.status.refunded")}</SelectItem>
            <SelectItem value="partially_refunded">{t("admin.orders.status.partiallyRefunded")}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ["admin-orders-stats"] });
          }}
          disabled={isFetching}
          title={t("admin.orders.refresh")}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{t("admin.orders.title")}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport(allOrders, "orders")}
            >
              <Download className="h-4 w-4 mr-2" />
              {t("admin.orders.export.button")}
            </Button>
          </div>
          <div className="relative min-h-[400px]">
             {isLoading ? (
              <AdminTableSkeleton columns={7} rows={10} />
            ) : (
              <OrdersTable orders={allOrders} />
            )}
            
            {/* Pulsing indicator for background refetching */}
            {!isLoading && isFetching && (
              <div className="absolute top-2 right-2 animate-pulse">
                <div className="h-2 w-2 bg-primary rounded-full" />
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) setCurrentPage(p => p - 1);
                      }}
                      className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <PaginationItem key={i}>
                        <PaginationLink
                          href="#"
                          isActive={currentPage === pageNum}
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(pageNum);
                          }}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) setCurrentPage(p => p + 1);
                      }}
                      className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>

              <p className="text-sm text-muted-foreground text-center mt-2">
                {t("admin.orders.pagination.pageInfo", { current: currentPage, total: totalPages, count: totalOrders })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{t("admin.orders.dialog.title")} - {selectedOrder?.id}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
              <div className="space-y-6">
                {/* Order Info */}
                <div className="grid grid-cols-2 gap-4 border rounded-lg p-4">
                  <div>
                    <Label className="text-muted-foreground">{t("admin.orders.dialog.date")}</Label>
                    <p className="text-sm font-medium">
                      {format(new Date(selectedOrder.createdAt || selectedOrder.created_at), "PPpp")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      {t("admin.orders.dialog.amount")}
                    </Label>
                    <p className="text-sm font-semibold">
                      ₹{selectedOrder.total}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">{t("admin.orders.dialog.customerInfo")}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">{t("common.status")}</Label>
                        <div className="mt-1">
                          {getStatusBadge(selectedOrder.status)}
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">
                          Payment Status
                        </Label>
                        <div className="mt-1">
                          <Badge
                            variant={
                              selectedOrder.paymentStatus === "paid"
                                ? "default"
                                : selectedOrder.paymentStatus === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {selectedOrder.paymentStatus}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cancel Request Details */}
                  {selectedOrder.cancelReason && (
                    <div className="border rounded-lg p-4 bg-amber-50">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <XIcon className="h-4 w-4" />
                        {t("admin.orders.dialog.cancellationRequest")}
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-muted-foreground">{t("admin.orders.dialog.reason")}</Label>
                          <p className="text-sm">{selectedOrder.cancelReason}</p>
                        </div>
                        {selectedOrder.cancelComments && (
                          <div>
                            <Label className="text-muted-foreground">
                              {t("admin.orders.dialog.comments")}
                            </Label>
                            <p className="text-sm">
                              {selectedOrder.cancelComments}
                            </p>
                          </div>
                        )}
                        {selectedOrder.cancelRequestedAt && (
                          <div>
                            <Label className="text-muted-foreground">
                              {t("admin.orders.dialog.requestedAt")}
                            </Label>
                            <p className="text-sm">
                              {format(
                                new Date(selectedOrder.cancelRequestedAt),
                                "PPpp"
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Return Request Details */}
                  {selectedOrder.returnReason && (
                    <div className="border rounded-lg p-4 bg-purple-50">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <RotateCcw className="h-4 w-4" />
                        {t("admin.orders.dialog.returnRequest")}
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <Label className="text-muted-foreground">{t("admin.orders.dialog.reason")}</Label>
                          <p className="text-sm">{selectedOrder.returnReason}</p>
                        </div>
                        {selectedOrder.returnIssue && (
                          <div>
                            <Label className="text-muted-foreground">
                              {t("admin.orders.dialog.issueDescription")}
                            </Label>
                            <p className="text-sm">{selectedOrder.returnIssue}</p>
                          </div>
                        )}
                        {selectedOrder.returnImages &&
                          selectedOrder.returnImages.length > 0 && (
                            <div>
                              <Label className="text-muted-foreground">
                                {t("admin.orders.dialog.images", { count: selectedOrder.returnImages.length })}
                              </Label>
                              <div className="grid grid-cols-3 gap-2 mt-2">
                                {selectedOrder.returnImages.map((img: string, idx: number) => (
                                  <img
                                    key={idx}
                                    src={img}
                                    alt={`Return ${idx + 1}`}
                                    loading="lazy"
                                    className="w-full h-24 object-cover rounded border"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        {selectedOrder.returnRequestedAt && (
                          <div>
                            <Label className="text-muted-foreground">
                              {t("admin.orders.dialog.requestedAt")}
                            </Label>
                            <p className="text-sm">
                              {format(
                                new Date(selectedOrder.returnRequestedAt),
                                "PPpp"
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Shipping Address */}
                  <div className="border rounded-lg p-4">
                    <Label className="text-muted-foreground">
                      {t("admin.orders.dialog.shippingAddress")}
                    </Label>
                    <div className="text-sm mt-2 space-y-1">
                      <p>{selectedOrder.shippingAddress?.addressLine || selectedOrder.shipping_address?.addressLine}</p>
                      <p>
                        {selectedOrder.shippingAddress?.city || selectedOrder.shipping_address?.city},{" "}
                        {selectedOrder.shippingAddress?.state || selectedOrder.shipping_address?.state}
                      </p>
                      <p>
                        {selectedOrder.shippingAddress?.country || selectedOrder.shipping_address?.country} -{" "}
                        {selectedOrder.shippingAddress?.pincode || selectedOrder.shipping_address?.pincode}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="border rounded-lg p-4">
                  <Label className="text-muted-foreground mb-3 block">
                    {t("admin.orders.dialog.orderItems")} ({selectedOrder.items.length})
                  </Label>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-2 bg-muted rounded"
                      >
                        {item.product?.images?.[0] && (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.title}
                            loading="lazy"
                            className="w-16 h-16 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{item.product?.title || 'Product'}</p>
                          <p className="text-sm text-muted-foreground">
                            Qty: {item.quantity} × ₹{item.product?.price || 0}
                          </p>
                        </div>
                        <p className="font-semibold">
                          ₹{(item.product?.price || 0) * item.quantity}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("admin.orders.dialog.updateStatus")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{t("admin.orders.table.status")}</Label>
              <div className="mt-2">
                {selectedOrder && getStatusBadge(selectedOrder.status)}
              </div>
            </div>
            <div>
              <Label htmlFor="newStatus">{t("admin.orders.dialog.selectStatus")}</Label>
              <Select
                value={newStatus}
                onValueChange={(value) => setNewStatus(value as OrderStatus)}
              >
                <SelectTrigger id="newStatus">
                  <SelectValue placeholder={t("admin.orders.dialog.selectStatus")} />
                </SelectTrigger>
                <SelectContent>
                  {selectedOrder &&
                    getNextStatuses(selectedOrder.status).map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`admin.orders.status.${status}`, status)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                {t("admin.orders.dialog.statusFlowHint")}
              </p>
            </div>

            {/* Show Return Details if active */}
            {activeReturnRequest && (
              <div className="border rounded-md p-3 bg-purple-50 space-y-3">
                <h4 className="font-medium flex items-center gap-2 text-purple-700">
                  <RotateCcw className="h-4 w-4" /> {t("admin.orders.dialog.returnRequest")}
                </h4>
                <div>
                  <Label className="text-xs text-muted-foreground">{t("admin.orders.dialog.reason")}</Label>
                  <p className="text-sm">{activeReturnRequest.reason}</p>
                </div>
                {/* Logic for return items here if needed, but keeping simple for now based on previous complexity risks */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">{t("admin.orders.dialog.orderItems")}</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {activeReturnRequest.return_items?.map((item: ReturnItem, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                        <div>
                          <p className="font-medium">{item.order_items?.title || "Item"}</p>
                          <p className="text-xs text-muted-foreground">{t("admin.orders.dialog.price")}: ₹{item.order_items?.price_per_unit}</p>
                        </div>
                        <div className="font-semibold">
                          {t("admin.orders.dialog.qty")}: {item.quantity}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t mt-2">
                  <span className="font-semibold text-sm">{t("admin.orders.dialog.estRefund") || "Est. Refund Amount"}</span>
                  <span className="font-bold text-purple-700">₹{activeReturnRequest.refund_amount}</span>
                </div>
              </div>
            )}
            {returnDetailsLoading && <div className="text-center py-2 text-xs text-muted-foreground">{t("admin.dashboard.loading")}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              {t("admin.orders.dialog.cancel")}
            </Button>
            <div className="flex gap-2">
              {activeReturnRequest ? (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setNewStatus('return_rejected');
                      handleStatusUpdate();
                    }}
                  >
                    {t("admin.orders.status.returnRejected")}
                  </Button>
                  <Button
                    onClick={() => {
                      setNewStatus('return_approved');
                      handleStatusUpdate();
                    }}
                  >
                    {t("admin.orders.status.returnApproved")}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleStatusUpdate}
                  disabled={!newStatus}
                >
                  {t("admin.orders.dialog.update")}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  );
}
