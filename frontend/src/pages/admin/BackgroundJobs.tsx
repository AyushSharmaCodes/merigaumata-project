import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Eye,
    RotateCcw,
    Play,
    Calendar,
    User,
    Mail,
    FileText,
    Clock,
    CheckCircle2,
    AlertCircle,
    Activity
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { getErrorMessage } from "@/lib/errorUtils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/authStore";

// Type Definitions
interface Job {
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
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
    correlationId: string;
    // Email specific
    recipient?: string;
    emailType?: string;
    // Refund specific
    orderId?: string;
    orderNumber?: string;
    paymentId?: string;
    refundId?: string;
    amount?: number;
    reason?: string;
    refundType?: string;
}

interface JobsResponse {
    success: boolean;
    jobs: Job[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

interface SchedulerStatus {
    success: boolean;
    running: boolean;
    jobs: Array<{ index: number; running: boolean }>;
    schedules: Record<string, string>;
}

interface StatsResponse {
    success: boolean;
    stats: any;
}

// Helper Components


export default function BackgroundJobs() {
    const { t } = useTranslation();
    const { user } = useAuthStore();

    // Helper Components moved inside to access t()
    const getStatusBadge = (status: string) => {
        const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
            PENDING: { variant: "secondary", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
            IN_PROGRESS: { variant: "default", className: "bg-blue-500 hover:bg-blue-500" },
            COMPLETED: { variant: "default", className: "bg-green-500 hover:bg-green-500" },
            FAILED: { variant: "destructive", className: "" },
            PARTIAL_FAILURE: { variant: "secondary", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
            BLOCKED: { variant: "secondary", className: "bg-orange-100 text-orange-800 hover:bg-orange-100" },
            CANCELLED: { variant: "secondary", className: "bg-gray-100 text-gray-600 hover:bg-gray-100" },
            processing: { variant: "default", className: "bg-blue-400 hover:bg-blue-400 animate-pulse" },
        };
        const config = variants[status] || { variant: "outline" as const, className: "" };

        // Map status to translation key
        const statusMap: Record<string, string> = {
            PENDING: "admin.backgroundJobs.statuses.pending",
            IN_PROGRESS: "admin.backgroundJobs.statuses.inProgress",
            COMPLETED: "admin.backgroundJobs.statuses.completed",
            FAILED: "admin.backgroundJobs.statuses.failed",
            PARTIAL_FAILURE: "admin.backgroundJobs.statuses.partialFailure",
            BLOCKED: "admin.backgroundJobs.statuses.blocked",
            CANCELLED: "admin.backgroundJobs.statuses.cancelled",
            processing: "admin.backgroundJobs.statuses.processing",
        };

        const label = statusMap[status] ? t(statusMap[status]) : status.replace("_", " ");
        return <Badge variant={config.variant} className={config.className}>{label}</Badge>;
    };

    const getTypeBadge = (type: string) => {
        if (type === "ACCOUNT_DELETION") {
            return (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    <User className="h-3 w-3 mr-1" />
                    {t("admin.backgroundJobs.types.accountDeletion")}
                </Badge>
            );
        } else if (type === "REFUND") {
            return (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                    <RotateCcw className="h-3 w-3 mr-1" />
                    {t("admin.backgroundJobs.types.refund")}
                </Badge>
            );
        } else if (type === "EMAIL_NOTIFICATION") {
            return (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    <Mail className="h-3 w-3 mr-1" />
                    {t("admin.backgroundJobs.types.emailNotification")}
                </Badge>
            );
        }
        return (
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                <Calendar className="h-3 w-3 mr-1" />
                {t("admin.backgroundJobs.types.eventCancellation")}
            </Badge>
        );
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

    const [typeFilter, setTypeFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const queryClient = useQueryClient();
    const limit = 10;

    // Constants with translations
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
        { value: "PROCESSING", label: t("admin.backgroundJobs.statuses.processing") },
    ];

    // --- Queries ---

    // 1. Batch Jobs Query
    const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs, isFetching: jobsFetching } = useQuery<JobsResponse>({
        queryKey: ["admin-jobs", typeFilter, statusFilter, page],
        queryFn: async () => {
            if (!user) throw new Error("User not authenticated");
            const params = new URLSearchParams();
            params.set("page", page.toString());
            params.set("limit", limit.toString());
            if (typeFilter !== "all") params.set("type", typeFilter);
            if (statusFilter !== "all") params.set("status", statusFilter);
            try {
                const response = await apiClient.get(`/admin/jobs?${params.toString()}`);
                return response.data;
            } catch (err: any) {
                console.error("[BackgroundJobs] Fetch failed:", err);
                throw err;
            }
        },
        enabled: !!user, // Only fetch when user is authenticated
    });

    // 2. Scheduler Status Query
    const { data: schedStatus, refetch: refetchSched, isFetching: schedFetching } = useQuery<SchedulerStatus>({
        queryKey: ["admin-scheduler-status"],
        queryFn: async () => {
            const response = await apiClient.get('/cron/scheduler-status');
            return response.data;
        },
        refetchInterval: 30000,
    });

    // 3. Email Stats Query
    const { data: emailStatsData, refetch: refetchEmailStats } = useQuery<StatsResponse>({
        queryKey: ["admin-email-stats"],
        queryFn: async () => {
            const response = await apiClient.get('/cron/email-stats');
            return response.data;
        },
        refetchInterval: 30000,
    });

    // 4. Invoice Stats Query
    const { data: invoiceStatsData, refetch: refetchInvoiceStats } = useQuery<StatsResponse>({
        queryKey: ["admin-invoice-stats"],
        queryFn: async () => {
            const response = await apiClient.get('/cron/invoice-stats');
            return response.data;
        },
        refetchInterval: 30000,
    });

    // 5. Orphan Stats Query
    const { data: orphanStatsData, refetch: refetchOrphanStats } = useQuery<any>({
        queryKey: ["admin-orphan-stats"],
        queryFn: async () => {
            const response = await apiClient.get('/cron/orphan-stats');
            return response.data;
        },
        refetchInterval: 30000,
    });

    // --- Mutations ---

    const retryJobMutation = useMutation({
        mutationFn: async (jobId: string) => {
            const response = await apiClient.post(`/admin/jobs/${jobId}/retry`);
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || t("admin.backgroundJobs.toasts.retrySuccess"));
            queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: (error: any) => {
            toast.error(getErrorMessage(error, t, "admin.backgroundJobs.toasts.retryFailed"));
        },
    });

    const processJobMutation = useMutation({
        mutationFn: async (jobId: string) => {
            const response = await apiClient.post(`/admin/jobs/${jobId}/process`);
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || t("admin.backgroundJobs.toasts.processSuccess"));
            queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
        },
        onError: (error: any) => {
            toast.error(getErrorMessage(error, t, "admin.backgroundJobs.toasts.processFailed"));
        },
    });

    const triggerEmailRetry = useMutation({
        mutationFn: async () => {
            const response = await apiClient.post('/cron/email-retry');
            return response.data;
        },
        onSuccess: () => {
            toast.success(t("admin.backgroundJobs.toasts.emailRetrySuccess"));
            refetchEmailStats();
        },
        onError: (error: any) => {
            toast.error(getErrorMessage(error, t, "admin.backgroundJobs.toasts.emailRetryFailed"));
        }
    });

    const triggerInvoiceRetry = useMutation({
        mutationFn: async () => {
            const response = await apiClient.post('/cron/invoice-retry');
            return response.data;
        },
        onSuccess: () => {
            toast.success(t("admin.backgroundJobs.toasts.invoiceTriggerSuccess"));
            refetchInvoiceStats();
        },
        onError: (error: any) => {
            toast.error(getErrorMessage(error, t, "admin.backgroundJobs.toasts.invoiceTriggerFailed"));
        },
    });

    const triggerOrphanSweep = useMutation({
        mutationFn: async () => {
            const response = await apiClient.post('/cron/orphan-sweeper');
            return response.data;
        },
        onSuccess: (data) => {
            toast.success(data.message || t("admin.backgroundJobs.toasts.sweepSuccess", { defaultValue: "Orphan sweep completed" }));
            refetchOrphanStats();
        },
        onError: (error: any) => {
            toast.error(getErrorMessage(error, t, "admin.backgroundJobs.toasts.sweepFailed"));
        },
    });

    // --- Utilities ---

    const handleViewDetails = (job: Job) => {
        setSelectedJob(job);
        setDetailsOpen(false); // Fix potential double dialog
        setTimeout(() => setDetailsOpen(true), 10);
    };

    const handleRefreshAll = () => {
        refetchJobs();
        refetchSched();
        refetchEmailStats();
        refetchInvoiceStats();
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

    const jobs = jobsData?.jobs || [];
    const pagination = jobsData?.pagination || { page: 1, limit, total: 0, totalPages: 1 };

    // Common info for batch jobs
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

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">{t("admin.backgroundJobs.title")}</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        {t("admin.backgroundJobs.subtitle")}
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleRefreshAll}
                    disabled={jobsFetching || schedFetching}
                >
                    <RefreshCw className={`h-4 w-4 ${(jobsFetching || schedFetching) ? "animate-spin" : ""}`} />
                </Button>
            </div>

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

                {/* Tab 1: Scheduled Tasks */}
                <TabsContent value="scheduled" className="space-y-6 pt-4">
                    {/* System Status Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                    {t("admin.backgroundJobs.scheduler.title")}
                                    {schedStatus?.running ?
                                        <CheckCircle2 className="h-4 w-4 text-green-500" /> :
                                        <AlertCircle className="h-4 w-4 text-destructive" />
                                    }
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{schedStatus?.running ? t("admin.backgroundJobs.scheduler.running") : t("admin.backgroundJobs.scheduler.stopped")}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t("admin.backgroundJobs.schedulerStatus.activeCronJobs", { count: schedStatus?.jobs?.length || 0 })}
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
                                    {t("admin.backgroundJobs.stats.orphanPayments", "Orphan Payments")}
                                    <AlertCircle className="h-4 w-4" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-amber-500">
                                    {orphanStatsData?.stats?.flagged_orphans || 0}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t("admin.backgroundJobs.stats.pendingSweep", "Pending Sweep")}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Manual Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">{t("admin.backgroundJobs.emailRetry.title")}</CardTitle>
                                <CardDescription>
                                    {t("admin.backgroundJobs.emailRetry.description")}
                                </CardDescription>
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
                                    onClick={() => triggerEmailRetry.mutate()}
                                    disabled={triggerEmailRetry.isPending || (emailStatsData?.stats?.FAILED || 0) === 0}
                                >
                                    <Play className="h-4 w-4 mr-2" />
                                    {t("admin.backgroundJobs.emailRetry.button")}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">{t("admin.backgroundJobs.invoiceRetry.title")}</CardTitle>
                                <CardDescription>
                                    {t("admin.backgroundJobs.invoiceRetry.description")}
                                </CardDescription>
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
                                    onClick={() => triggerInvoiceRetry.mutate()}
                                    disabled={triggerInvoiceRetry.isPending || (invoiceStatsData?.stats?.orders?.failed || 0) === 0}
                                >
                                    <Play className="h-4 w-4 mr-2" />
                                    {t("admin.backgroundJobs.invoiceRetry.button")}
                                </Button>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">{t("admin.backgroundJobs.orphanSweep.title", "Orphan Payment Sweeper")}</CardTitle>
                                <CardDescription>
                                    {t("admin.backgroundJobs.orphanSweep.description", "Automatically refunds captured payments where no order was created.")}
                                </CardDescription>
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
                                    onClick={() => triggerOrphanSweep.mutate()}
                                    disabled={triggerOrphanSweep.isPending || (orphanStatsData?.stats?.flagged_orphans || 0) === 0}
                                >
                                    <Play className="h-4 w-4 mr-2" />
                                    {t("admin.backgroundJobs.orphanSweep.button", "Run Sweeper")}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Configured Schedules */}
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("admin.backgroundJobs.configuredSchedules.title")}</CardTitle>
                            <CardDescription>{t("admin.backgroundJobs.configuredSchedules.subtitle")}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t("admin.backgroundJobs.configuredSchedules.taskName")}</TableHead>
                                        <TableHead>{t("admin.backgroundJobs.configuredSchedules.schedule")}</TableHead>
                                        <TableHead>{t("common.status")}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {schedStatus?.schedules && Object.entries(schedStatus.schedules).map(([key, value]) => (
                                        <TableRow key={key}>
                                            <TableCell className="font-medium font-mono">{key}</TableCell>
                                            <TableCell className="font-mono text-xs">{value}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">{t("admin.backgroundJobs.configuredSchedules.active")}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 2: Batch Jobs (Legacy View) */}
                <TabsContent value="batch" className="space-y-4 pt-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder={t("admin.backgroundJobs.filters.filterByType")} />
                            </SelectTrigger>
                            <SelectContent>
                                {TYPE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder={t("admin.backgroundJobs.filters.filterByStatus")} />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-sm text-muted-foreground ml-auto">
                            {t("admin.backgroundJobs.filters.showing", { count: jobs.length, total: pagination.total })}
                        </span>
                    </div>

                    {/* Table View */}
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
                                {jobsLoading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8">{t("admin.backgroundJobs.table.loading")}</TableCell></TableRow>
                                ) : jobs.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8">{t("admin.backgroundJobs.table.noJobs")}</TableCell></TableRow>
                                ) : (
                                    jobs.map((job) => {
                                        const subject = getJobSubject(job);
                                        return (
                                            <TableRow key={job.id}>
                                                <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}...</TableCell>
                                                <TableCell>{getTypeBadge(job.type)}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-sm">{subject.primary}</span>
                                                        <span className="text-xs text-muted-foreground">{subject.secondary}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getStatusBadge(job.status)}</TableCell>
                                                <TableCell className="text-xs">{formatDate(job.updatedAt)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(job)} title={t("admin.backgroundJobs.tooltips.viewDetails")}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {job.status === "PENDING" && (
                                                            <Button
                                                                variant="ghost" size="icon"
                                                                onClick={() => processJobMutation.mutate(job.id)}
                                                                disabled={processJobMutation.isPending}
                                                                title={t("admin.backgroundJobs.tooltips.processJob")}
                                                                className="text-green-600"
                                                            >
                                                                <Play className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {canRetry(job) && (
                                                            <Button
                                                                variant="ghost" size="icon"
                                                                onClick={() => retryJobMutation.mutate(job.id)}
                                                                disabled={retryJobMutation.isPending}
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

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between gap-3 pt-2">
                            <p className="text-sm text-muted-foreground">
                                {t("admin.backgroundJobs.pagination.page", { current: pagination.page, total: pagination.totalPages })}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline" size="sm"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                                </Button>
                                <Button
                                    variant="outline" size="sm"
                                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                    disabled={page >= pagination.totalPages}
                                >
                                    Next <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Details Dialog (Unified for all jobs) */}
            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {t("admin.backgroundJobs.dialog.title")}
                            {selectedJob && getTypeBadge(selectedJob.type)}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedJob && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.jobId")}</span>
                                    <p className="font-mono text-xs sm:text-sm break-all">{selectedJob.id}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">{t("common.status")}:</span>
                                    <div className="mt-1">{getStatusBadge(selectedJob.status)}</div>
                                </div>
                                {selectedJob.type === "ACCOUNT_DELETION" && (
                                    <>
                                        <div className="sm:col-span-2">
                                            <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.user")}</span>
                                            <p className="break-all font-medium">{selectedJob.userName} ({selectedJob.userEmail})</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.currentStep")}</span>
                                            <p className="font-mono text-xs">{selectedJob.currentStep || "LOCK_USER"}</p>
                                        </div>
                                    </>
                                )}
                                {selectedJob.type === "EVENT_CANCELLATION" && (
                                    <>
                                        <div className="sm:col-span-2">
                                            <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.event")}</span>
                                            <p className="font-medium">{selectedJob.eventTitle}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.processed")}</span>
                                            <p>{selectedJob.processedCount || 0} / {selectedJob.totalRegistrations || 0}</p>
                                        </div>
                                    </>
                                )}
                                <div>
                                    <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.createdAt")}</span>
                                    <p>{formatDate(selectedJob.createdAt)}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.updatedAt")}</span>
                                    <p>{formatDate(selectedJob.updatedAt)}</p>
                                </div>
                                {selectedJob.type === "REFUND" && (
                                    <>
                                        <div>
                                            <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.amount")}</span>
                                            <p className="font-medium">₹{selectedJob.amount}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.refundType")}</span>
                                            <p>{selectedJob.refundType || "N/A"}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.paymentId")}</span>
                                            <p className="font-mono text-xs">{selectedJob.paymentId}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.refundId")}</span>
                                            <p className="font-mono text-xs">{selectedJob.refundId || "Pending"}</p>
                                        </div>
                                        {selectedJob.reason && (
                                            <div className="sm:col-span-2">
                                                <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.reason")}</span>
                                                <p className="text-sm">{selectedJob.reason}</p>
                                            </div>
                                        )}
                                    </>
                                )}
                                {selectedJob.type === "EMAIL_NOTIFICATION" && (
                                    <>
                                        <div>
                                            <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.recipient")}</span>
                                            <p className="font-medium">{selectedJob.recipient}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.emailType")}</span>
                                            <p>{selectedJob.emailType?.replace(/_/g, " ")}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">{t("admin.backgroundJobs.dialog.retryCount")}</span>
                                            <p>{selectedJob.retryCount || 0} / 3</p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {selectedJob.errorLog && selectedJob.errorLog.length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-muted-foreground text-sm font-medium">{t("admin.backgroundJobs.dialog.logsErrors")}</span>
                                    <div className="p-3 bg-destructive/5 border border-destructive/10 rounded-md max-h-40 overflow-y-auto">
                                        {selectedJob.errorLog.map((log, i) => (
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
                                {selectedJob.status === "PENDING" && (
                                    <Button
                                        className="flex-1 bg-green-600"
                                        onClick={() => { processJobMutation.mutate(selectedJob.id); setDetailsOpen(false); }}
                                    >
                                        <Play className="h-4 w-4 mr-2" /> {t("admin.backgroundJobs.actions.startProcessing")}
                                    </Button>
                                )}
                                {canRetry(selectedJob) && (
                                    <Button
                                        className="flex-1"
                                        onClick={() => { retryJobMutation.mutate(selectedJob.id); setDetailsOpen(false); }}
                                    >
                                        <RotateCcw className="h-4 w-4 mr-2" /> {t("admin.backgroundJobs.actions.retryJob")}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
