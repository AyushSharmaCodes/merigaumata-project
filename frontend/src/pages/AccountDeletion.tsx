import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
    AlertTriangle,
    Shield,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    ArrowLeft,
    Calendar,
    ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/authStore";
import { apiClient } from "@/lib/api-client";
import { BackButton } from "@/components/ui/BackButton";
import { ProfileMessages } from "@/constants/messages/ProfileMessages";
import { ErrorMessages } from "@/constants/messages/ErrorMessages";
import { CommonMessages } from "@/constants/messages/CommonMessages";

// Types
interface BlockingReason {
    type: string;
    count?: number;
    message: string;
    action?: { label: string; url: string };
}

interface EligibilityResponse {
    eligible: boolean;
    blockingReasons: BlockingReason[];
}

interface DeletionStatus {
    status: string;
    scheduledFor?: string;
    requestedAt?: string;
}

const AccountDeletionPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // State
    const [step, setStep] = useState<"check" | "otp" | "confirm">("check");
    const [otp, setOtp] = useState("");
    const [authToken, setAuthToken] = useState("");
    const [deletionMode, setDeletionMode] = useState<"immediate" | "scheduled">("scheduled");
    const [scheduleDays, setScheduleDays] = useState(15);
    const [reason, setReason] = useState("");
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    // Eligibility Query
    const { data: eligibility, isLoading: eligibilityLoading, refetch: refetchEligibility } = useQuery<EligibilityResponse>({
        queryKey: ["deletion-eligibility"],
        queryFn: async () => {
            const response = await apiClient.get("/account/delete/eligibility");
            return response.data;
        },
        enabled: !!user,
    });

    // Status Query
    const { data: deletionStatus } = useQuery<DeletionStatus>({
        queryKey: ["deletion-status"],
        queryFn: async () => {
            const response = await apiClient.get("/account/delete/status");
            return response.data;
        },
        enabled: !!user,
    });

    // Request OTP Mutation
    const requestOtpMutation = useMutation({
        mutationFn: async () => {
            const response = await apiClient.post("/account/delete/request-otp");
            return response.data;
        },
        onSuccess: () => {
            setStep("otp");
            toast({
                title: t(ProfileMessages.VERIFICATION_CODE_SENT),
                description: t(ProfileMessages.CODE_SENT_DESC),
            });
        },
        onError: (error: any) => {
            toast({
                title: t(ProfileMessages.SEND_CODE_FAILED),
                description: error.response?.data?.error || t(ErrorMessages.AUTH_ERROR_OCCURRED),
                variant: "destructive",
            });
        },
    });

    // Verify OTP Mutation
    const verifyOtpMutation = useMutation({
        mutationFn: async (otpValue: string) => {
            const response = await apiClient.post("/account/delete/verify-otp", { otp: otpValue });
            return response.data;
        },
        onSuccess: (data) => {
            setAuthToken(data.authorizationToken);
            setStep("confirm");
            toast({
                title: t(ProfileMessages.VERIFIED_SUCCESS),
                description: t(ProfileMessages.VERIFIED_DESC),
            });
        },
        onError: (error: any) => {
            toast({
                title: t(ProfileMessages.VERIFY_CODE_FAILED),
                description: error.response?.data?.error || t(ErrorMessages.AUTH_INVALID_OTP),
                variant: "destructive",
            });
        },
    });

    // Confirm Deletion Mutation
    const confirmDeletionMutation = useMutation({
        mutationFn: async () => {
            if (deletionMode === "immediate") {
                return apiClient.post("/account/delete/confirm", { authorizationToken: authToken, reason });
            } else {
                return apiClient.post("/account/delete/schedule", {
                    authorizationToken: authToken,
                    days: scheduleDays,
                    reason
                });
            }
        },
        onSuccess: (response) => {
            setShowConfirmDialog(false);
            queryClient.invalidateQueries({ queryKey: ["deletion-status"] });

            if (deletionMode === "immediate") {
                toast({
                    title: t(ProfileMessages.ACCOUNT_DELETED_SUCCESS),
                    description: t(ProfileMessages.ACCOUNT_DELETED_DESC),
                });
                setTimeout(() => logout(), 2000);
            } else {
                toast({
                    title: t(ProfileMessages.DELETION_SCHEDULED_SUCCESS),
                    description: t(ProfileMessages.DELETION_SCHEDULED_DESC, {
                        date: new Date(response.data.scheduledFor).toLocaleDateString()
                    }),
                });
                navigate("/profile");
            }
        },
        onError: (error: any) => {
            toast({
                title: t(ProfileMessages.DELETION_FAILED),
                description: error.response?.data?.error || t(ErrorMessages.AUTH_ERROR_OCCURRED),
                variant: "destructive",
            });
        },
    });

    // Cancel Scheduled Deletion Mutation
    const cancelDeletionMutation = useMutation({
        mutationFn: async () => {
            return apiClient.post("/account/delete/cancel");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["deletion-status"] });
            toast({
                title: t(ProfileMessages.DELETION_CANCELLED_SUCCESS),
                description: t(ProfileMessages.DELETION_CANCELLED_DESC),
            });
        },
        onError: (error: any) => {
            toast({
                title: t(ProfileMessages.CANCEL_DELETION_FAILED),
                description: error.response?.data?.error || t(ErrorMessages.AUTH_ERROR_OCCURRED),
                variant: "destructive",
            });
        },
    });

    // If user is Admin, block UI immediately
    if (user?.role === 'admin') {
        return (
            <div className="min-h-screen bg-[#FAF7F2]/30 py-12">
                <div className="container mx-auto px-4 max-w-2xl">
                    <BackButton className="mb-8" />

                    <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
                        <CardHeader className="bg-amber-50 p-8 text-center">
                            <div className="mx-auto w-20 h-20 rounded-3xl bg-amber-100 flex items-center justify-center mb-4">
                                <Shield className="h-10 w-10 text-amber-600" />
                            </div>
                            <CardTitle className="text-2xl font-bold text-[#2C1810]">
                                {t(ProfileMessages.ADMIN_PROTECTED_TITLE)}
                            </CardTitle>
                            <CardDescription className="text-amber-700 text-lg">
                                {t(ProfileMessages.ADMIN_PROTECTED_SUB)}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6 text-center">
                            <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200">
                                <p className="text-[#2C1810] leading-relaxed">
                                    {t(ProfileMessages.ADMIN_PROTECTED_DESC)}
                                </p>
                            </div>

                            <p className="text-muted-foreground">
                                {t(ProfileMessages.ADMIN_PROTECTED_CONTACT)}
                            </p>

                            <Button
                                className="w-full h-14 rounded-xl bg-[#2C1810] hover:bg-[#B85C3C]"
                                onClick={() => navigate("/profile")}
                            >
                                {t(ProfileMessages.RETURN_TO_PROFILE)}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // If user has pending deletion, show status
    if (deletionStatus?.status === "PENDING_DELETION") {
        return (
            <div className="min-h-screen bg-[#FAF7F2]/30 py-12">
                <div className="container mx-auto px-4 max-w-2xl">
                    <BackButton className="mb-8" />

                    <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
                        <CardHeader className="bg-amber-50 p-8">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
                                    <Clock className="h-8 w-8 text-amber-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-bold text-[#2C1810]">
                                        {t(ProfileMessages.DELETION_SCHEDULED_STATUS)}
                                    </CardTitle>
                                    <CardDescription className="text-amber-700">
                                        {t(ProfileMessages.DELETION_SCHEDULED_STATUS)}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="p-6 bg-amber-50 rounded-2xl">
                                <p className="text-sm text-amber-800">
                                    <Calendar className="inline h-4 w-4 mr-2" />
                                    {t(ProfileMessages.SCHEDULED_FOR, {
                                        date: new Date(deletionStatus.scheduledFor!).toLocaleDateString()
                                    })}
                                </p>
                            </div>

                            <p className="text-muted-foreground">
                                {t(ProfileMessages.DELETION_CANCEL_HELP)}
                            </p>

                            <Button
                                variant="outline"
                                className="w-full h-14 rounded-xl border-2"
                                onClick={() => cancelDeletionMutation.mutate()}
                                disabled={cancelDeletionMutation.isPending}
                            >
                                {cancelDeletionMutation.isPending ? (
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                ) : (
                                    <XCircle className="h-5 w-5 mr-2" />
                                )}
                                {t(ProfileMessages.CANCEL_SCHEDULED_DELETION)}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAF7F2]/30 py-12">
            <div className="container mx-auto px-4 max-w-2xl">
                <BackButton className="mb-8" />

                {/* Warning Header */}
                <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-2xl">
                    <div className="flex items-start gap-4">
                        <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                        <div>
                            <h2 className="font-bold text-red-900">{t(ProfileMessages.PERMANENT_DELETION)}</h2>
                            <p className="text-sm text-red-700 mt-1">
                                {t(ProfileMessages.ACTION_UNDONE)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Step 1: Eligibility Check */}
                {step === "check" && (
                    <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
                        <CardHeader className="p-8 border-b">
                            <CardTitle className="text-2xl font-bold text-[#2C1810]">
                                {t(ProfileMessages.DELETE_ACCOUNT_TITLE)}
                            </CardTitle>
                            <CardDescription>
                                {t(ProfileMessages.DELETE_ACCOUNT_DESC)}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            {eligibilityLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : eligibility?.eligible ? (
                                <div className="space-y-6">
                                    <div className="p-6 bg-green-50 rounded-2xl flex items-center gap-4">
                                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                                        <div>
                                            <p className="font-bold text-green-900">{t(ProfileMessages.ACCOUNT_ELIGIBLE)}</p>
                                            <p className="text-sm text-green-700">{t(ProfileMessages.PROCEED_DELETION)}</p>
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full h-14 rounded-xl bg-red-600 hover:bg-red-700"
                                        onClick={() => requestOtpMutation.mutate()}
                                        disabled={requestOtpMutation.isPending}
                                    >
                                        {requestOtpMutation.isPending ? (
                                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        ) : (
                                            <Shield className="h-5 w-5 mr-2" />
                                        )}
                                        {t(ProfileMessages.VERIFY_IDENTITY)}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-6 bg-amber-50 rounded-2xl">
                                        <p className="font-bold text-amber-900 mb-2">
                                            {t(ProfileMessages.CANNOT_DELETE)}
                                        </p>
                                        <p className="text-sm text-amber-700">
                                            {t(ProfileMessages.RESOLVE_ISSUES)}
                                        </p>
                                    </div>

                                    {eligibility?.blockingReasons.map((reason, index) => (
                                        <div key={index} className="p-4 bg-white border rounded-xl flex items-start gap-4">
                                            <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="font-medium text-[#2C1810]">{reason.message}</p>
                                                {reason.action && (
                                                    <Button
                                                        variant="link"
                                                        className="p-0 h-auto text-sm text-[#B85C3C]"
                                                        onClick={() => navigate(reason.action!.url)}
                                                    >
                                                        {reason.action.label}
                                                        <ExternalLink className="h-3 w-3 ml-1" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => refetchEligibility()}
                                    >
                                        {t(ProfileMessages.REFRESH_STATUS)}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: OTP Verification */}
                {step === "otp" && (
                    <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
                        <CardHeader className="p-8 border-b">
                            <CardTitle className="text-2xl font-bold text-[#2C1810]">
                                {t(ProfileMessages.VERIFY_IDENTITY)}
                            </CardTitle>
                            <CardDescription>
                                {t(ProfileMessages.ENTER_CODE, { email: user?.email })}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="account-deletion-otp">{t(ProfileMessages.VERIFICATION_CODE)}</Label>
                                <Input
                                    id="account-deletion-otp"
                                    type="text"
                                    autoComplete="one-time-code"
                                    placeholder="000000"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    className="text-center text-2xl tracking-widest h-14"
                                    maxLength={6}
                                />
                            </div>

                            <Button
                                className="w-full h-14 rounded-xl bg-[#2C1810] hover:bg-[#B85C3C]"
                                onClick={() => verifyOtpMutation.mutate(otp)}
                                disabled={otp.length !== 6 || verifyOtpMutation.isPending}
                            >
                                {verifyOtpMutation.isPending ? (
                                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                ) : null}
                                {t(ProfileMessages.VERIFY_CODE)}
                            </Button>

                            <Button
                                variant="ghost"
                                className="w-full"
                                onClick={() => requestOtpMutation.mutate()}
                                disabled={requestOtpMutation.isPending}
                            >
                                {t(ProfileMessages.RESEND_CODE)}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Step 3: Confirmation */}
                {step === "confirm" && (
                    <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
                        <CardHeader className="p-8 border-b">
                            <CardTitle className="text-2xl font-bold text-[#2C1810]">
                                {t(ProfileMessages.CHOOSE_DELETION_TYPE)}
                            </CardTitle>
                            <CardDescription>
                                {t(ProfileMessages.SELECT_DELETION_MODE)}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <RadioGroup value={deletionMode} onValueChange={(v) => setDeletionMode(v as any)}>
                                <div className="space-y-4">
                                    <div className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${deletionMode === "scheduled" ? "border-[#B85C3C] bg-orange-50" : "border-gray-200"
                                        }`} onClick={() => setDeletionMode("scheduled")}>
                                        <div className="flex items-center gap-4">
                                            <RadioGroupItem value="scheduled" id="scheduled" />
                                            <div className="flex-1">
                                                <Label className="font-bold cursor-pointer">
                                                    {t(ProfileMessages.SCHEDULED_DELETION)}
                                                </Label>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {t(ProfileMessages.SCHEDULED_DELETION_DESC)}
                                                </p>
                                            </div>
                                        </div>

                                        {deletionMode === "scheduled" && (
                                            <div className="mt-2 pl-8">
                                                <p className="text-sm text-[#B85C3C] font-medium">
                                                    {t(ProfileMessages.DAYS_NOTICE, { days: scheduleDays })}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${deletionMode === "immediate" ? "border-red-500 bg-red-50" : "border-gray-200"
                                        }`} onClick={() => setDeletionMode("immediate")}>
                                        <div className="flex items-center gap-4">
                                            <RadioGroupItem value="immediate" id="immediate" />
                                            <div className="flex-1">
                                                <Label className="font-bold cursor-pointer text-red-900">
                                                    {t(ProfileMessages.IMMEDIATE_DELETION)}
                                                </Label>
                                                <p className="text-sm text-red-700 mt-1">
                                                    {t(ProfileMessages.IMMEDIATE_DELETION_DESC)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </RadioGroup>

                            <div className="space-y-2">
                                <Label htmlFor="account-deletion-reason">{t(ProfileMessages.REASON_LEAVING)}</Label>
                                <Textarea
                                    id="account-deletion-reason"
                                    autoComplete="off"
                                    placeholder={t(ProfileMessages.REASON_PLACEHOLDER)}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="resize-none"
                                    rows={3}
                                />
                            </div>

                            <Button
                                className={`w-full h-14 rounded-xl ${deletionMode === "immediate"
                                    ? "bg-red-600 hover:bg-red-700"
                                    : "bg-[#B85C3C] hover:bg-[#2C1810]"
                                    }`}
                                onClick={() => setShowConfirmDialog(true)}
                            >
                                {deletionMode === "immediate" ? t(ProfileMessages.DELETE_NOW) : t(ProfileMessages.SCHEDULE_DELETION)}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Confirmation Dialog */}
                <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="text-red-600 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                {deletionMode === "immediate" ? t(ProfileMessages.CONFIRM_IMMEDIATE) : t(ProfileMessages.CONFIRM_SCHEDULED)}
                            </DialogTitle>
                            <DialogDescription>
                                {deletionMode === "immediate"
                                    ? t(ProfileMessages.DELETION_WARNING_IMMEDIATE)
                                    : t(ProfileMessages.DELETION_WARNING_SCHEDULED, { days: scheduleDays })
                                }
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                                {t(CommonMessages.CANCEL)}
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => confirmDeletionMutation.mutate()}
                                disabled={confirmDeletionMutation.isPending}
                            >
                                {confirmDeletionMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : null}
                                {deletionMode === "immediate" ? t(ProfileMessages.DELETE_MY_ACCOUNT) : t(ProfileMessages.SCHEDULE_DELETION)}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
};

export default AccountDeletionPage;
