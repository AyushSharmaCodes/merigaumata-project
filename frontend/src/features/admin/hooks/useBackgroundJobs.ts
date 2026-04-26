import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/shared/hooks/use-toast";
import { apiClient } from "@/core/api/api-client";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { logger } from "@/core/observability/logger";
import { useAuthStore } from "@/domains/auth";

// Type Definitions
export interface Job {
    id: string;
    type: "ACCOUNT_DELETION" | "EVENT_CANCELLATION" | "REFUND" | "EMAIL_NOTIFICATION";
    status: string;
    mode: string;
    userId?: string;
    userEmail?: string;
    userName?: string;
    currentStep?: string | null;
    stepsCompleted?: string[];
    scheduledFor?: string | null;
    eventId?: string;
    eventTitle?: string;
    eventStatus?: string;
    eventStartDate?: string;
    eventLocation?: string;
    totalRegistrations?: number;
    processedCount?: number;
    failedCount?: number;
    batchSize?: number;
    errorLog: Array<{ step?: string; error?: string; message?: string; timestamp: string; registrationId?: string }>;
    retryCount: number;
    isStale?: boolean;
    needsAttention?: boolean;
    attentionReason?: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    correlationId: string;
    recipient?: string;
    emailType?: string;
    orderId?: string;
    orderNumber?: string;
    paymentId?: string;
    refundId?: string;
    amount?: number;
    reason?: string;
    refundType?: string;
}

export interface JobsResponse {
    success: boolean;
    jobs: Job[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface SchedulerStatus {
    success: boolean;
    enabled?: boolean;
    running: boolean;
    jobs: Array<{ index: number; running: boolean }>;
    schedules: Record<string, string>;
    disabledReason?: string | null;
}

export interface StatsResponse {
    success: boolean;
    stats: any;
}

export const useBackgroundJobs = () => {
    const { t } = useTranslation();
    const { toast } = useToast();
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
    const highlightedJobId = searchParams.get("jobId");
    const [typeFilter, setTypeFilter] = useState(searchParams.get("type") || "all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const limit = 10;

    // --- Queries ---
    const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs, isFetching: jobsFetching } = useQuery<JobsResponse>({
        queryKey: ["admin-jobs", typeFilter, statusFilter, page],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("page", page.toString());
            params.set("limit", limit.toString());
            if (typeFilter !== "all") params.set("type", typeFilter);
            if (statusFilter !== "all") params.set("status", statusFilter);
            const response = await apiClient.get(`/admin/jobs?${params.toString()}`);
            return response.data;
        },
        enabled: !!user,
    });

    const { data: schedStatus, refetch: refetchSched, isFetching: schedFetching } = useQuery<SchedulerStatus>({
        queryKey: ["admin-scheduler-status"],
        queryFn: async () => {
            const response = await apiClient.get('/cron/scheduler-status');
            return response.data;
        },
        refetchInterval: 30000,
        enabled: !!user,
    });

    const { data: emailStatsData, refetch: refetchEmailStats } = useQuery<StatsResponse>({
        queryKey: ["admin-email-stats"],
        queryFn: async () => {
            const response = await apiClient.get('/cron/email-stats');
            return response.data;
        },
        refetchInterval: 30000,
        enabled: !!user,
    });

    const { data: invoiceStatsData, refetch: refetchInvoiceStats } = useQuery<StatsResponse>({
        queryKey: ["admin-invoice-stats"],
        queryFn: async () => {
            const response = await apiClient.get('/cron/invoice-stats');
            return response.data;
        },
        refetchInterval: 30000,
        enabled: !!user,
    });

    const { data: orphanStatsData, refetch: refetchOrphanStats } = useQuery<any>({
        queryKey: ["admin-orphan-stats"],
        queryFn: async () => {
            const response = await apiClient.get('/cron/orphan-stats');
            return response.data;
        },
        refetchInterval: 30000,
        enabled: !!user,
    });

    // --- Mutations ---
    const retryJobMutation = useMutation({
        mutationFn: async (jobId: string) => {
            const response = await apiClient.post(`/admin/jobs/${jobId}/retry`);
            return response.data;
        },
        onSuccess: (data) => {
            toast({ title: t("common.success"), description: data.message });
            queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: (error: any) => {
            toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" });
        },
    });

    const processJobMutation = useMutation({
        mutationFn: async (jobId: string) => {
            const response = await apiClient.post(`/admin/jobs/${jobId}/process`);
            return response.data;
        },
        onSuccess: (data) => {
            toast({ title: t("common.success"), description: data.message });
            queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: (error: any) => {
            toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" });
        },
    });

    const triggerEmailRetry = useMutation({
        mutationFn: async () => {
            const response = await apiClient.post('/cron/email-retry');
            return response.data;
        },
        onSuccess: () => {
            toast({ title: t("common.success"), description: t("admin.backgroundJobs.toasts.emailRetrySuccess") });
            refetchEmailStats();
        },
        onError: (error: any) => {
            toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" });
        }
    });

    const triggerInvoiceRetry = useMutation({
        mutationFn: async () => {
            const response = await apiClient.post('/cron/invoice-retry');
            return response.data;
        },
        onSuccess: () => {
            toast({ title: t("common.success"), description: t("admin.backgroundJobs.toasts.invoiceTriggerSuccess") });
            refetchInvoiceStats();
        },
        onError: (error: any) => {
            toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" });
        },
    });

    const triggerOrphanSweep = useMutation({
        mutationFn: async () => {
            const response = await apiClient.post('/cron/orphan-sweeper');
            return response.data;
        },
        onSuccess: (data) => {
            toast({ title: t("common.success"), description: data.message || t("admin.backgroundJobs.toasts.sweepSuccess") });
            refetchOrphanStats();
        },
        onError: (error: any) => {
            toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" });
        },
    });

    const handleRefreshAll = () => {
        refetchJobs();
        refetchSched();
        refetchEmailStats();
        refetchInvoiceStats();
        refetchOrphanStats();
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "-";
        try {
            return new Date(dateString).toLocaleString("en-IN", {
                dateStyle: "short",
                timeStyle: "short",
            });
        } catch (e) {
            return "-";
        }
    };

    const getJobSubject = (job: Job) => {
        if (job.type === "ACCOUNT_DELETION") {
            return {
                primary: job.userName || "N/A",
                secondary: job.userEmail || "N/A"
            };
        } else if (job.type === "REFUND") {
            return {
                primary: `Refund: ₹${job.amount || 0}`,
                secondary: job.orderId
                    ? `Order: ${job.orderNumber || "Pending"} (${job.orderId.substring(0, 8)})`
                    : (job.paymentId || "Unknown Payment")
            };
        } else if (job.type === "EMAIL_NOTIFICATION") {
            return {
                primary: job.recipient || "N/A",
                secondary: job.emailType?.replace(/_/g, " ") || "N/A"
            };
        }
        return {
            primary: job.eventTitle || t("admin.backgroundJobs.table.unknownEvent"),
            secondary: `${job.processedCount || 0}/${job.totalRegistrations || 0} processed`
        };
    };

    const canRetry = (job: Job) => {
        if (job.type === "ACCOUNT_DELETION") {
            return job.status === "FAILED" || job.status === "BLOCKED";
        }
        if (job.type === "REFUND") {
            return job.status === "FAILED" || job.status === "PARTIAL_FAILURE";
        }
        if (job.type === "EMAIL_NOTIFICATION") {
            return job.status === "FAILED";
        }
        return job.status === "FAILED" || job.status === "PARTIAL_FAILURE";
    };

    return {
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
    };
};
