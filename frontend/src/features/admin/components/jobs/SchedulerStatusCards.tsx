import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { AlertTriangle, CheckCircle2, AlertCircle, Mail, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SchedulerStatus, StatsResponse } from "../../hooks/useBackgroundJobs";

interface SchedulerStatusCardsProps {
  schedStatus: SchedulerStatus | undefined;
  emailStatsData: StatsResponse | undefined;
  invoiceStatsData: StatsResponse | undefined;
  orphanStatsData: any;
}

export const SchedulerStatusCards = ({
  schedStatus,
  emailStatsData,
  invoiceStatsData,
  orphanStatsData,
}: SchedulerStatusCardsProps) => {
  const { t } = useTranslation();
  
  const schedulerEnabled = schedStatus?.enabled !== false;
  const schedulerRunning = Boolean(schedStatus?.running);
  const schedulerStateLabel = !schedulerEnabled
    ? t("admin.backgroundJobs.scheduler.disabled")
    : schedulerRunning
      ? t("admin.backgroundJobs.scheduler.running")
      : t("admin.backgroundJobs.scheduler.stopped");

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            {t("admin.backgroundJobs.scheduler.title")}
            {!schedulerEnabled ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : schedulerRunning ?
              <CheckCircle2 className="h-4 w-4 text-green-500" /> :
              <AlertCircle className="h-4 w-4 text-destructive" />
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{schedulerStateLabel}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {!schedulerEnabled
              ? (schedStatus?.disabledReason || t("admin.backgroundJobs.scheduler.disabledHint"))
              : t("admin.backgroundJobs.schedulerStatus.activeCronJobs", { count: schedStatus?.jobs?.length || 0 })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            {t("admin.backgroundJobs.stats.failedEmails")}
            <Mail className="h-4 w-4" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            {emailStatsData?.stats?.FAILED || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("admin.backgroundJobs.stats.pendingRetry")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            {t("admin.backgroundJobs.stats.failedInvoices")}
            <FileText className="h-4 w-4" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            {invoiceStatsData?.stats?.orders?.failed || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("admin.backgroundJobs.stats.regenerationRequired")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
            {t("admin.backgroundJobs.stats.orphanPayments")}
            <AlertCircle className="h-4 w-4" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-500">
            {orphanStatsData?.stats?.flagged_orphans || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("admin.backgroundJobs.stats.pendingSweep")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
