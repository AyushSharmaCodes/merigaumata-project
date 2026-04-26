import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { eventService } from "@/domains/content";
import { toast } from "@/shared/hooks/use-toast";
import { CancellationJobStatus } from "@/shared/types";

interface EventJobStatusBadgeProps {
  eventId: string;
  onRetry: (eventId: string) => void;
  isRetrying: boolean;
}

export const EventJobStatusBadge = ({ eventId, onRetry, isRetrying }: EventJobStatusBadgeProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: jobStatus } = useQuery<CancellationJobStatus | null>({
    queryKey: ["job-status", eventId],
    queryFn: () => eventService.getJobStatus(eventId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'IN_PROGRESS' || status === 'PENDING' ? 3000 : false;
    },
  });

  const [lastStatus, setLastStatus] = useState<string | null>(null);

  useEffect(() => {
    if (jobStatus?.status && lastStatus && lastStatus !== jobStatus.status) {
      if (jobStatus.status === 'COMPLETED') {
        toast({ title: t("admin.events.toasts.cancelInitiated") });
        queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      } else if (['FAILED', 'PARTIAL_FAILURE'].includes(jobStatus.status)) {
        toast({ title: t("admin.events.jobs.status.failed"), variant: "destructive" });
      }
    }
    if (jobStatus?.status) setLastStatus(jobStatus.status);
  }, [jobStatus, lastStatus, queryClient, t]);

  if (!jobStatus) return null;

  const statusConfig: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
    PENDING: { icon: <Loader2 className="h-3 w-3 animate-spin" />, className: "bg-blue-100 text-blue-700", label: t("admin.events.jobs.pending") },
    IN_PROGRESS: { icon: <Loader2 className="h-3 w-3 animate-spin" />, className: "bg-blue-100 text-blue-700", label: t("admin.events.jobs.processing") },
    COMPLETED: { icon: <CheckCircle2 className="h-3 w-3" />, className: "bg-green-100 text-green-700", label: t("admin.events.jobs.completed") },
    PARTIAL_FAILURE: { icon: <AlertTriangle className="h-3 w-3" />, className: "bg-orange-100 text-orange-700", label: t("admin.events.jobs.partial") },
    FAILED: { icon: <XCircle className="h-3 w-3" />, className: "bg-red-100 text-red-700", label: t("admin.events.jobs.failed") },
  };

  const config = statusConfig[jobStatus.status] || statusConfig.PENDING;
  const showRetry = ['FAILED', 'PARTIAL_FAILURE'].includes(jobStatus.status);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Badge variant="outline" className={`text-[10px] font-bold px-2 py-0.5 ${config.className} border-none cursor-help`}>
                {config.icon}
                <span className="ml-1">{config.label}</span>
              </Badge>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <div className="space-y-1">
              <p className="font-semibold">{t("admin.events.jobs.jobTitle")}: {jobStatus.status}</p>
              <p>{t("admin.events.jobs.processedInfo", { processed: jobStatus.processed_count || 0, total: jobStatus.total_registrations || 0 })}</p>
              {jobStatus.failed_count > 0 && <p className="text-red-500">{t("admin.events.jobs.failedCount", { count: jobStatus.failed_count })}</p>}
            </div>
          </TooltipContent>
        </Tooltip>
        {showRetry && (
          <Button
            variant="ghost" size="icon" className="h-6 w-6 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            onClick={() => onRetry(eventId)} disabled={isRetrying}
          >
            {isRetrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
};
