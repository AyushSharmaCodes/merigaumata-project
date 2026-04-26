import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Play, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { JobTypeBadge } from "./JobTypeBadge";
import { JobStatusBadge } from "./JobStatusBadge";
import type { Job } from "../../hooks/useBackgroundJobs";

interface JobDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job | null;
  formatDate: (date: string | null) => string;
  canRetry: (job: Job) => boolean;
  onProcess: (id: string) => void;
  onRetry: (id: string) => void;
}

export const JobDetailsDialog = ({
  open,
  onOpenChange,
  job,
  formatDate,
  canRetry,
  onProcess,
  onRetry,
}: JobDetailsDialogProps) => {
  const { t } = useTranslation();

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("admin.backgroundJobs.dialog.title")}
            <JobTypeBadge type={job.type} />
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.jobId")}</span>
              <p className="font-mono text-xs sm:text-sm break-all">{job.id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t("common.status")}:</span>
              <div className="mt-1"><JobStatusBadge status={job.status} /></div>
            </div>
            
            {job.type === "ACCOUNT_DELETION" && (
              <>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.user")}</span>
                  <p className="break-all font-medium">{job.userName} ({job.userEmail})</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.currentStep")}</span>
                  <p className="font-mono text-xs">{job.currentStep || "LOCK_USER"}</p>
                </div>
              </>
            )}
            
            {job.type === "EVENT_CANCELLATION" && (
              <>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.event")}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-medium">{job.eventTitle}</p>
                    {job.needsAttention && (
                      <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
                        {job.isStale ? "Stale" : "Needs Attention"}
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.processed")}</span>
                  <p>{job.processedCount || 0} / {job.totalRegistrations || 0}</p>
                </div>
              </>
            )}
            
            <div>
              <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.createdAt")}</span>
              <p>{formatDate(job.createdAt)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.updatedAt")}</span>
              <p>{formatDate(job.updatedAt)}</p>
            </div>
            
            {job.type === "REFUND" && (
              <>
                <div>
                  <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.amount")}</span>
                  <p className="font-medium">₹{job.amount}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.refundType")}</span>
                  <p>{job.refundType || "N/A"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.paymentId")}</span>
                  <p className="font-mono text-xs">{job.paymentId}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.refundId")}</span>
                  <p className="font-mono text-xs">{job.refundId || "Pending"}</p>
                </div>
                {job.reason && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.reason")}</span>
                    <p className="text-sm">{job.reason}</p>
                  </div>
                )}
              </>
            )}
            
            {job.type === "EMAIL_NOTIFICATION" && (
              <>
                <div>
                  <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.recipient")}</span>
                  <p className="font-medium">{job.recipient}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.emailType")}</span>
                  <p>{job.emailType?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.retryCount")}</span>
                  <p>{job.retryCount || 0} / 3</p>
                </div>
              </>
            )}
          </div>

          {job.errorLog && job.errorLog.length > 0 && (
            <div className="space-y-2">
              <span className="text-muted-foreground text-sm font-medium">{t("admin.backgroundJobs.dialog.logsErrors")}</span>
              <div className="p-3 bg-destructive/5 border border-destructive/10 rounded-md max-h-40 overflow-y-auto">
                {job.errorLog.map((log, i) => (
                  <div key={i} className="text-xs mb-2 pb-2 border-b border-destructive/5 last:border-0">
                    <div className="font-mono text-destructive mb-1">{log.step || t("admin.backgroundJobs.dialog.error")}</div>
                    <div className="text-muted-foreground italic">{log.message || log.error}</div>
                    <div className="text-[10px] text-muted-foreground/60 mt-1">{formatDate(log.timestamp)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {job.status === "PENDING" && (
              <Button
                className="flex-1 bg-green-600"
                onClick={() => onProcess(job.id)}
              >
                <Play className="h-4 w-4 mr-2" /> {t("admin.backgroundJobs.actions.startProcessing")}
              </Button>
            )}
            {canRetry(job) && (
              <Button
                className="flex-1"
                onClick={() => onRetry(job.id)}
              >
                <RotateCcw className="h-4 w-4 mr-2" /> {t("admin.backgroundJobs.actions.retryJob")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
