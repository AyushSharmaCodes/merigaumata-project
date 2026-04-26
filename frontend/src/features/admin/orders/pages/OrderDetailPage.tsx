import { Suspense } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, RefreshCcw, XCircle } from "lucide-react";
import { orderOrchestrator } from "@/application/order";
import { useOrderDetail } from "@/features/orders";
import { ReturnHistorySection } from "@/features/returns";
import { ReturnAuditView } from "@/features/admin/returns";
import { TaxAuditSection } from "@/features/admin/taxation";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
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
import { OrderDetailSkeleton } from "@/shared/components/ui/page-skeletons";
import { DeliveryUnsuccessfulDialog } from "../components/order-detail/DeliveryUnsuccessfulDialog";
import { OrderCancellationDialog } from "../components/order-detail/OrderCancellationDialog";
import { OrderCustomerSection } from "../components/order-detail/OrderCustomerSection";
import { OrderEmailLogsSection } from "../components/order-detail/OrderEmailLogsSection";
import { OrderItemsSection } from "../components/order-detail/OrderItemsSection";
import { OrderPaymentSection } from "../components/order-detail/OrderPaymentSection";
import { OrderTimelineSection } from "../components/order-detail/OrderTimelineSection";

function SectionLoadingCard({ label }: { label: string }) {
  return (
    <Card className="border-none shadow-sm bg-white">
      <CardContent className="p-10 flex flex-col items-center justify-center gap-3">
        <RefreshCcw className="h-6 w-6 animate-spin text-slate-400" />
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      </CardContent>
    </Card>
  );
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const {
    order,
    orderLoading,
    updating,
    statusToUpdate,
    confirmDialogOpen,
    setConfirmDialogOpen,
    cancelDialogOpen,
    setCancelDialogOpen,
    unsuccessfulDialogOpen,
    setUnsuccessfulDialogOpen,
    regenerating,
    isAuditingReturn,
    setIsAuditingReturn,
    setSelectedReturnId,
    activeReturnRequest,
    hasReturnHistory,
    sortedHistory,
    returnRequests,
    handleStatusUpdate,
    handleConfirmStatusUpdate,
    handleReturnAction,
    handleQCComplete,
    handleCancelOrder,
    handleUnsuccessfulDelivery,
    handleRegenerateInvoice,
    formatOrderStatusLabel,
  } = useOrderDetail(id);

  const activeReturnStatus = activeReturnRequest?.status?.toLowerCase() || "requested";

  if (orderLoading && !order) return <OrderDetailSkeleton />;
  if (!order) return <OrderDetailSkeleton />;

  return (
    <div className="space-y-6 font-sans">
      {hasReturnHistory && (
        <div className="sticky top-16 z-40 -mx-4 lg:-mx-8 px-4 lg:px-8 pb-4 bg-slate-50/80 backdrop-blur-md border-b border-orange-100">
          <div
            className={`relative overflow-hidden rounded-2xl p-[1px] shadow-xl group animate-in fade-in slide-in-from-top-4 duration-700
              ${activeReturnStatus === "approved" ? "bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-500 shadow-emerald-200/40" :
                activeReturnStatus === "rejected" ? "bg-gradient-to-r from-red-600 via-rose-600 to-red-500 shadow-red-200/40" :
                  "bg-gradient-to-r from-orange-600 via-amber-600 to-amber-500 shadow-amber-200/40"}`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent pointer-events-none" />
            <div className="bg-white/95 backdrop-blur-sm rounded-[15px] px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-5">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-500
                    ${activeReturnStatus === "approved" ? "bg-emerald-100 text-emerald-600" :
                      activeReturnStatus === "rejected" ? "bg-red-100 text-red-600" :
                        "bg-amber-100 text-amber-600"}`}
                >
                  <span className="relative flex h-5 w-5">
                    {activeReturnStatus === "requested" && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    )}
                    {activeReturnStatus === "approved" ? (
                      <CheckCircle2 className="relative inline-flex h-5 w-5" />
                    ) : activeReturnStatus === "rejected" ? (
                      <XCircle className="relative inline-flex h-5 w-5" />
                    ) : (
                      <AlertCircle className="relative inline-flex h-5 w-5" />
                    )}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 leading-tight">
                    {isAuditingReturn
                      ? t("admin.orders.detail.audit.titleInProgress")
                      : activeReturnStatus === "approved"
                        ? t("admin.orders.detail.returnApproved")
                        : activeReturnStatus === "rejected"
                          ? t("admin.orders.detail.returnRejected")
                          : t("admin.orders.detail.audit.title")}
                    {activeReturnStatus === "requested" && !isAuditingReturn && (
                      <Badge className="bg-orange-500 text-white border-none text-[8px] h-4 font-black px-1.5 uppercase tracking-tighter shadow-sm">
                        {t("admin.orders.detail.urgent")}
                      </Badge>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide opacity-80 mt-0.5">
                    {activeReturnStatus === "rejected"
                      ? t(
                          "admin.orders.detail.audit.rejectedDesc",
                          "This return request has been denied. The customer can re-submit with updated details."
                        )
                      : activeReturnStatus === "approved"
                        ? t(
                            "admin.orders.detail.audit.approvedDesc",
                            "Audit complete. The item is now eligible for pickup or refund processing."
                          )
                        : t("admin.orders.detail.audit.description")}
                  </p>
                </div>
              </div>
              <Button
                variant={isAuditingReturn ? "outline" : "default"}
                onClick={() => {
                  setIsAuditingReturn(true);
                  setTimeout(() => {
                    document.getElementById("return-audit-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 100);
                }}
                className={`font-black text-[10px] uppercase tracking-[0.15em] px-8 h-12 rounded-xl shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-95 group flex items-center gap-2 shrink-0
                  ${isAuditingReturn ? "border-slate-200 text-slate-700 bg-slate-50" :
                    activeReturnStatus === "approved" ? "bg-emerald-600 hover:bg-emerald-700 text-white" :
                      activeReturnStatus === "rejected" ? "bg-red-600 hover:bg-red-700 text-white" :
                        "bg-amber-600 hover:bg-amber-700 text-white"}`}
              >
                <span>
                  {isAuditingReturn
                    ? t("admin.orders.detail.viewingAudit")
                    : activeReturnStatus === "approved" || activeReturnStatus === "rejected"
                      ? t("admin.orders.detail.viewAuditSummary")
                      : t("admin.orders.detail.audit.cta")}
                </span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {isAuditingReturn && (
        <div id="return-audit-section" className="animate-in zoom-in-95 fill-mode-both duration-500">
          {activeReturnRequest ? (
            <Suspense fallback={<SectionLoadingCard label={t("admin.orders.detail.audit.loadingData", "Retrieving Detailed Claim Data...")} />}>
              <ReturnAuditView
                order={order}
                returnRequest={activeReturnRequest}
                updating={updating}
                onBack={() => setIsAuditingReturn(false)}
                onApprove={async (returnId, notes) => {
                  await handleReturnAction(returnId, "approve", notes);
                }}
                onReject={async (returnId, notes) => {
                  await handleReturnAction(returnId, "reject", notes);
                  setIsAuditingReturn(false);
                }}
                onMarkPickedUp={async (returnId) => {
                  await handleReturnAction(returnId, "picked_up");
                }}
                onMarkReturned={async (returnId) => {
                  await handleReturnAction(returnId, "item_returned");
                }}
                onUpdateStatus={async (returnId, nextStatus) => {
                  await handleReturnAction(returnId, nextStatus as string);
                }}
                onQCComplete={handleQCComplete}
                history={sortedHistory}
              />
            </Suspense>
          ) : (
            <Card className="border-none shadow-xl bg-white p-20 flex flex-col items-center justify-center gap-4 rounded-3xl">
              <p className="text-sm font-bold text-slate-700">
                {t("admin.orders.detail.audit.empty", "No return request is available for audit.")}
              </p>
            </Card>
          )}
        </div>
      )}

      {!isAuditingReturn && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <Link to="/admin/orders" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-2 w-fit">
                <ArrowLeft className="h-4 w-4" />
                {t("admin.orders.detail.header.backToOrders")}
              </Link>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">{t("admin.orders.detail.header.title", { number: order.order_number })}</h1>
                <Badge
                  variant={
                    order.status === "delivered"
                      ? "default"
                      : ["cancelled", "cancelled_by_admin", "cancelled_by_customer"].includes(order.status)
                        ? "destructive"
                        : "secondary"
                  }
                  className={`uppercase ${
                    order.status === "pending"
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
                      : order.status === "shipped"
                        ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                        : order.status === "delivered"
                          ? "bg-green-600 text-white hover:bg-green-600"
                          : order.status === "processing"
                            ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-100"
                            : ""
                  }`}
                >
                  {formatOrderStatusLabel(order.status)}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <OrderItemsSection items={order.items || []} />

              <Suspense fallback={<SectionLoadingCard label={t("admin.orders.detail.taxAudit.title", "Detailed Tax Summary & Audit")} />}>
                <TaxAuditSection
                  items={order.items || []}
                  subtotal={order.subtotal}
                  coupon_discount={order.coupon_discount}
                  delivery_charge={order.delivery_charge}
                  delivery_gst={order.delivery_gst}
                  total_amount={order.total_amount}
                  isInterState={(order.items?.[0]?.igst || 0) > 0}
                />
              </Suspense>

              <OrderEmailLogsSection emailLogs={order.email_logs || []} />
            </div>

            <div className="space-y-6">
              <OrderCustomerSection order={order} />

              <OrderPaymentSection
                order={order}
                openInvoiceDocument={orderOrchestrator.openInvoiceDocument}
                handleRegenerateInvoice={handleRegenerateInvoice}
                regenerating={regenerating}
              />
            </div>
          </div>

          <ReturnHistorySection
            returns={returnRequests}
            orderId={order.id}
            viewMode="admin"
            onReturnClick={(returnId) => {
              const selected = returnRequests.find((item) => item.id === returnId);
              if (selected) {
                setSelectedReturnId(returnId);
                setIsAuditingReturn(true);
              }
            }}
          />

          <OrderTimelineSection
            order={order}
            updating={updating}
            onUpdateStatus={handleStatusUpdate}
            onOpenCancelDialog={() => setCancelDialogOpen(true)}
          />
        </div>
      )}

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.orders.detail.confirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.orders.detail.confirm.description", {
                status: statusToUpdate ? formatOrderStatusLabel(statusToUpdate) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmStatusUpdate()} disabled={updating}>
              {updating ? t("common.loading") : t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrderCancellationDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={handleCancelOrder}
        isPending={updating}
      />

      <DeliveryUnsuccessfulDialog
        open={unsuccessfulDialogOpen}
        onOpenChange={setUnsuccessfulDialogOpen}
        onConfirm={handleUnsuccessfulDelivery}
        isPending={updating}
      />
    </div>
  );
}
