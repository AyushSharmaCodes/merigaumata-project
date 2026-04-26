import { Badge } from "@/shared/components/ui/badge";
import { useTranslation } from "react-i18next";

interface JobStatusBadgeProps {
  status: string;
}

export const JobStatusBadge = ({ status }: JobStatusBadgeProps) => {
  const { t } = useTranslation();
  
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
    PENDING: { variant: "secondary", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
    IN_PROGRESS: { variant: "default", className: "bg-blue-500 hover:bg-blue-500" },
    COMPLETED: { variant: "default", className: "bg-green-500 hover:bg-green-500" },
    FAILED: { variant: "destructive", className: "" },
    PARTIAL_FAILURE: { variant: "secondary", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
    BLOCKED: { variant: "secondary", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
    CANCELLED: { variant: "secondary", className: "bg-gray-100 text-gray-600 hover:bg-gray-100" },
    processing: { variant: "default", className: "bg-blue-400 hover:bg-blue-400 animate-pulse" },
    PROCESSING: { variant: "default", className: "bg-blue-400 hover:bg-blue-400 animate-pulse" },
  };

  const config = variants[status] || { variant: "outline" as const, className: "" };

  const statusMap: Record<string, string> = {
    PENDING: "admin.backgroundJobs.statuses.pending",
    IN_PROGRESS: "admin.backgroundJobs.statuses.inProgress",
    COMPLETED: "admin.backgroundJobs.statuses.completed",
    FAILED: "admin.backgroundJobs.statuses.failed",
    PARTIAL_FAILURE: "admin.backgroundJobs.statuses.partialFailure",
    BLOCKED: "admin.backgroundJobs.statuses.blocked",
    CANCELLED: "admin.backgroundJobs.statuses.cancelled",
    processing: "admin.backgroundJobs.statuses.processing",
    PROCESSING: "admin.backgroundJobs.statuses.processing",
  };

  const label = statusMap[status] ? t(statusMap[status]) : status.replace("_", " ");
  
  return <Badge variant={config.variant} className={config.className}>{label}</Badge>;
};
