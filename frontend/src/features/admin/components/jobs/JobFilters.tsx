import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";
import { useTranslation } from "react-i18next";

interface JobFiltersProps {
    typeFilter: string;
    onTypeFilterChange: (value: string) => void;
    statusFilter: string;
    onStatusFilterChange: (value: string) => void;
    count: number;
    total: number;
}

export const JobFilters = ({
    typeFilter,
    onTypeFilterChange,
    statusFilter,
    onStatusFilterChange,
    count,
    total,
}: JobFiltersProps) => {
    const { t } = useTranslation();

    const TYPE_OPTIONS = [
        { value: "all", label: t("admin.backgroundJobs.types.all") },
        { value: "ACCOUNT_DELETION", label: t("admin.backgroundJobs.types.accountDeletion") },
        { value: "EVENT_CANCELLATION", label: t("admin.backgroundJobs.types.eventCancellation") },
        { value: "REFUND", label: t("admin.backgroundJobs.types.refund") },
        { value: "EMAIL_NOTIFICATION", label: t("admin.backgroundJobs.types.emailNotification") },
    ];

    const STATUS_OPTIONS = [
        { value: "all", label: t("admin.backgroundJobs.statuses.all") },
        { value: "PENDING", label: t("admin.backgroundJobs.statuses.pending") },
        { value: "IN_PROGRESS", label: t("admin.backgroundJobs.statuses.inProgress") },
        { value: "COMPLETED", label: t("admin.backgroundJobs.statuses.completed") },
        { value: "FAILED", label: t("admin.backgroundJobs.statuses.failed") },
        { value: "PARTIAL_FAILURE", label: t("admin.backgroundJobs.statuses.partialFailure") },
        { value: "BLOCKED", label: t("admin.backgroundJobs.statuses.blocked") },
        { value: "CANCELLED", label: t("admin.backgroundJobs.statuses.cancelled") },
        { value: "processing", label: t("admin.backgroundJobs.statuses.processing") },
    ];

    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Select value={typeFilter} onValueChange={onTypeFilterChange}>
                <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder={t("admin.backgroundJobs.filters.filterByType")} />
                </SelectTrigger>
                <SelectContent>
                    {TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder={t("admin.backgroundJobs.filters.filterByStatus")} />
                </SelectTrigger>
                <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground ml-auto">
                {t("admin.backgroundJobs.filters.showing", { count, total })}
            </span>
        </div>
    );
};
