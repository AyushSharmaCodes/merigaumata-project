import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Activity, AlertTriangle, ChevronLeft, ChevronRight, Clock, RefreshCw } from "lucide-react";
import { JobDetailsDialog } from "../components/jobs/JobDetailsDialog";
import { JobFilters } from "../components/jobs/JobFilters";
import { JobTable } from "../components/jobs/JobTable";
import { ManualControlCards } from "../components/jobs/ManualControlCards";
import { SchedulerSchedulesTable } from "../components/jobs/SchedulerSchedulesTable";
import { SchedulerStatusCards } from "../components/jobs/SchedulerStatusCards";
import { useBackgroundJobs } from "../hooks/useBackgroundJobs";

export function BackgroundJobsPage() {
  const {
    t,
    jobsData,
    jobsLoading,
    jobsFetching,
    schedStatus,
    schedFetching,
    emailStatsData,
    invoiceStatsData,
    orphanStatsData,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    selectedJob,
    setSelectedJob,
    detailsOpen,
    setDetailsOpen,
    highlightedJobId,
    retryJobMutation,
    processJobMutation,
    triggerEmailRetry,
    triggerInvoiceRetry,
    triggerOrphanSweep,
    handleRefreshAll,
    formatDate,
    getJobSubject,
    canRetry,
  } = useBackgroundJobs();

  const jobs = jobsData?.jobs || [];
  const pagination = jobsData?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };
  const eventAttentionCount = jobs.filter((job) => job.type === "EVENT_CANCELLATION" && job.needsAttention).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t("admin.backgroundJobs.title")}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t("admin.backgroundJobs.subtitle")}</p>
        </div>
        <Button variant="outline" onClick={handleRefreshAll} disabled={jobsFetching || schedFetching}>
          <RefreshCw className={`h-4 w-4 ${(jobsFetching || schedFetching) ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {eventAttentionCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">
                  {eventAttentionCount}{" "}
                  {eventAttentionCount > 1
                    ? t("admin.backgroundJobs.alerts.jobsNeedAttention")
                    : t("admin.backgroundJobs.alerts.jobNeedsAttention")}
                </p>
                <p className="text-sm text-amber-800">{t("admin.backgroundJobs.description")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="scheduled" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="scheduled">
            <Clock className="h-4 w-4 mr-2" />
            {t("admin.backgroundJobs.tabs.scheduled")}
          </TabsTrigger>
          <TabsTrigger value="batch">
            <Activity className="h-4 w-4 mr-2" />
            {t("admin.backgroundJobs.tabs.batch")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="space-y-6 pt-4">
          <SchedulerStatusCards
            schedStatus={schedStatus}
            emailStatsData={emailStatsData}
            invoiceStatsData={invoiceStatsData}
            orphanStatsData={orphanStatsData}
          />
          <ManualControlCards
            emailStatsData={emailStatsData}
            invoiceStatsData={invoiceStatsData}
            orphanStatsData={orphanStatsData}
            onTriggerEmailRetry={() => triggerEmailRetry.mutate()}
            onTriggerInvoiceRetry={() => triggerInvoiceRetry.mutate()}
            onTriggerOrphanSweep={() => triggerOrphanSweep.mutate()}
            isEmailPending={triggerEmailRetry.isPending}
            isInvoicePending={triggerInvoiceRetry.isPending}
            isOrphanPending={triggerOrphanSweep.isPending}
          />
          <SchedulerSchedulesTable schedStatus={schedStatus} />
        </TabsContent>

        <TabsContent value="batch" className="space-y-4 pt-4">
          <JobFilters
            typeFilter={typeFilter}
            onTypeFilterChange={(value) => {
              setTypeFilter(value);
              setPage(1);
            }}
            statusFilter={statusFilter}
            onStatusFilterChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            count={jobs.length}
            total={pagination.total}
          />

          <JobTable
            jobs={jobs}
            isLoading={jobsLoading}
            highlightedJobId={highlightedJobId}
            onViewDetails={(job) => {
              setSelectedJob(job);
              setDetailsOpen(true);
            }}
            onProcess={(id) => processJobMutation.mutate(id)}
            onRetry={(id) => retryJobMutation.mutate(id)}
            canRetry={canRetry}
            formatDate={formatDate}
            getJobSubject={getJobSubject}
            isProcessing={processJobMutation.isPending || retryJobMutation.isPending}
          />

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-sm text-muted-foreground">
                {t("admin.backgroundJobs.pagination.page", { current: pagination.page, total: pagination.totalPages })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                  disabled={page >= pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <JobDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        job={selectedJob}
        formatDate={formatDate}
        canRetry={canRetry}
        onProcess={(id) => {
          processJobMutation.mutate(id);
          setDetailsOpen(false);
        }}
        onRetry={(id) => {
          retryJobMutation.mutate(id);
          setDetailsOpen(false);
        }}
      />
    </div>
  );
}
