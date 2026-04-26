import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Eye, Play, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { JobTypeBadge } from "./JobTypeBadge";
import { JobStatusBadge } from "./JobStatusBadge";
import type { Job } from "../../hooks/useBackgroundJobs";

interface JobTableProps {
  jobs: Job[];
  isLoading: boolean;
  highlightedJobId: string | null;
  onViewDetails: (job: Job) => void;
  onProcess: (id: string) => void;
  onRetry: (id: string) => void;
  canRetry: (job: Job) => boolean;
  formatDate: (date: string | null) => string;
  getJobSubject: (job: Job) => { primary: string; secondary: string };
  isProcessing: boolean;
}

export const JobTable = ({
  jobs,
  isLoading,
  highlightedJobId,
  onViewDetails,
  onProcess,
  onRetry,
  canRetry,
  formatDate,
  getJobSubject,
  isProcessing,
}: JobTableProps) => {
  const { t } = useTranslation();

  return (
    <div className="border rounded-lg overflow-x-auto bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">{t("admin.backgroundJobs.table.id")}</TableHead>
            <TableHead>{t("admin.backgroundJobs.table.type")}</TableHead>
            <TableHead>{t("admin.backgroundJobs.table.subject")}</TableHead>
            <TableHead>{t("common.status")}</TableHead>
            <TableHead>{t("admin.backgroundJobs.table.updated")}</TableHead>
            <TableHead className="text-right">{t("admin.backgroundJobs.table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8">{t("admin.backgroundJobs.table.loading")}</TableCell></TableRow>
          ) : jobs.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center py-8">{t("admin.backgroundJobs.table.noJobs")}</TableCell></TableRow>
          ) : (
            jobs.map((job) => {
              const subject = getJobSubject(job);
              const highlighted = highlightedJobId === job.id;
              return (
                <TableRow key={job.id} className={highlighted ? "bg-amber-50/80" : undefined}>
                  <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}...</TableCell>
                  <TableCell><JobTypeBadge type={job.type} /></TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm flex items-center gap-2">
                        <span>{subject.primary}</span>
                        {job.needsAttention && (
                          <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
                            {job.isStale ? t("admin.backgroundJobs.labels.stale") : t("admin.backgroundJobs.labels.needsAttention")}
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{subject.secondary}</span>
                    </div>
                  </TableCell>
                  <TableCell><JobStatusBadge status={job.status} /></TableCell>
                  <TableCell className="text-xs">{formatDate(job.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onViewDetails(job)} title={t("admin.backgroundJobs.tooltips.viewDetails")}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {job.status === "PENDING" && (
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => onProcess(job.id)}
                          disabled={isProcessing}
                          title={t("admin.backgroundJobs.tooltips.processJob")}
                          className="text-green-600"
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {canRetry(job) && (
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => onRetry(job.id)}
                          disabled={isProcessing}
                          title={t("admin.backgroundJobs.tooltips.retryJob")}
                          className="text-orange-600"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
