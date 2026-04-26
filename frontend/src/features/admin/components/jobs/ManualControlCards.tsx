import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StatsResponse } from "../../hooks/useBackgroundJobs";

interface ManualControlCardsProps {
  emailStatsData: StatsResponse | undefined;
  invoiceStatsData: StatsResponse | undefined;
  orphanStatsData: any;
  onTriggerEmailRetry: () => void;
  onTriggerInvoiceRetry: () => void;
  onTriggerOrphanSweep: () => void;
  isEmailPending: boolean;
  isInvoicePending: boolean;
  isOrphanPending: boolean;
}

export const ManualControlCards = ({
  emailStatsData,
  invoiceStatsData,
  orphanStatsData,
  onTriggerEmailRetry,
  onTriggerInvoiceRetry,
  onTriggerOrphanSweep,
  isEmailPending,
  isInvoicePending,
  isOrphanPending,
}: ManualControlCardsProps) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("admin.backgroundJobs.emailRetry.title")}</CardTitle>
          <CardDescription>{t("admin.backgroundJobs.emailRetry.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted rounded-md text-sm">
            <div className="flex justify-between mb-1">
              <span>{t("admin.backgroundJobs.emailRetry.totalNotifications")}</span>
              <span className="font-medium">{String(Object.values(emailStatsData?.stats || {}).reduce((a: any, b: any) => a + b, 0))}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>{t("admin.backgroundJobs.emailRetry.sent")}</span>
              <span className="text-green-600 font-medium">{emailStatsData?.stats?.SENT || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("admin.backgroundJobs.emailRetry.failed")}</span>
              <span className="text-destructive font-medium">{emailStatsData?.stats?.FAILED || 0}</span>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={onTriggerEmailRetry}
            disabled={isEmailPending || (emailStatsData?.stats?.FAILED || 0) === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            {t("admin.backgroundJobs.emailRetry.button")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("admin.backgroundJobs.invoiceRetry.title")}</CardTitle>
          <CardDescription>{t("admin.backgroundJobs.invoiceRetry.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted rounded-md text-sm">
            <div className="flex justify-between mb-1">
              <span>{t("admin.backgroundJobs.invoiceRetry.ordersWithInvoices")}</span>
              <span className="font-medium">{invoiceStatsData?.stats?.orders?.generated || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("admin.backgroundJobs.invoiceRetry.failedGeneration")}</span>
              <span className="text-destructive font-medium">{invoiceStatsData?.stats?.orders?.failed || 0}</span>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={onTriggerInvoiceRetry}
            disabled={isInvoicePending || (invoiceStatsData?.stats?.orders?.failed || 0) === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            {t("admin.backgroundJobs.invoiceRetry.button")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("admin.backgroundJobs.orphanSweep.title", "Orphan Payment Sweeper")}</CardTitle>
          <CardDescription>{t("admin.backgroundJobs.orphanSweep.description", "Automatically refunds captured payments where no order was created.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted rounded-md text-sm">
            <div className="flex justify-between mb-1">
              <span>{t("admin.backgroundJobs.orphanSweep.flagged", "Flagged Orphans")}</span>
              <span className="font-medium text-amber-600">{orphanStatsData?.stats?.flagged_orphans || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("admin.backgroundJobs.orphanSweep.refunded", "Successfully Refunded")}</span>
              <span className="text-green-600 font-medium">{orphanStatsData?.stats?.refunded_orphans || 0}</span>
            </div>
          </div>
          <Button
            className="w-full"
            onClick={onTriggerOrphanSweep}
            disabled={isOrphanPending || (orphanStatsData?.stats?.flagged_orphans || 0) === 0}
          >
            <Play className="h-4 w-4 mr-2" />
            {t("admin.backgroundJobs.orphanSweep.button", "Run Sweeper")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
