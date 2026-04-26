import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuthStore } from "@/domains/auth";
import { apiClient } from "@/core/api/api-client";
import { ProfileMessages } from "@/shared/constants/messages/ProfileMessages";
import { ErrorMessages } from "@/shared/constants/messages/ErrorMessages";

export interface BlockingReason {
    type: string;
    count?: number;
    message: string;
    action?: { label: string; url: string };
}

export interface EligibilityResponse {
    eligible: boolean;
    blockingReasons: BlockingReason[];
}

export interface DeletionStatus {
    status: string;
    scheduledFor?: string;
    requestedAt?: string;
}

export const useAccountDeletion = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [step, setStep] = useState<"check" | "otp" | "confirm">("check");
    const [otp, setOtp] = useState("");
    const [authToken, setAuthToken] = useState("");
    const [deletionMode, setDeletionMode] = useState<"immediate" | "scheduled">("scheduled");
    const [scheduleDays, setScheduleDays] = useState(15);
    const [reason, setReason] = useState("");
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    const { data: eligibility, isLoading: eligibilityLoading, refetch: refetchEligibility } = useQuery<EligibilityResponse>({
        queryKey: ["deletion-eligibility"],
        queryFn: async () => {
            const response = await apiClient.get("/account/delete/eligibility");
            return response.data;
        },
        enabled: !!user,
    });

    const { data: deletionStatus } = useQuery<DeletionStatus>({
        queryKey: ["deletion-status"],
        queryFn: async () => {
            const response = await apiClient.get("/account/delete/status");
            return response.data;
        },
        enabled: !!user,
    });

    const requestOtpMutation = useMutation({
        mutationFn: async () => {
            const response = await apiClient.post("/account/delete/request-otp");
            return response.data;
        },
        onSuccess: () => {
            setStep("otp");
            toast({ title: t(ProfileMessages.VERIFICATION_CODE_SENT), description: t(ProfileMessages.CODE_SENT_DESC) });
        },
        onError: (error: any) => {
            toast({ title: t(ProfileMessages.SEND_CODE_FAILED), description: error.response?.data?.error || t(ErrorMessages.AUTH_ERROR_OCCURRED), variant: "destructive" });
        },
    });

    const verifyOtpMutation = useMutation({
        mutationFn: async (otpValue: string) => {
            const response = await apiClient.post("/account/delete/verify-otp", { otp: otpValue });
            return response.data;
        },
        onSuccess: (data) => {
            setAuthToken(data.authorizationToken);
            setStep("confirm");
            toast({ title: t(ProfileMessages.VERIFIED_SUCCESS), description: t(ProfileMessages.VERIFIED_DESC) });
        },
        onError: (error: any) => {
            toast({ title: t(ProfileMessages.VERIFY_CODE_FAILED), description: error.response?.data?.error || t(ErrorMessages.AUTH_INVALID_OTP), variant: "destructive" });
        },
    });

    const confirmDeletionMutation = useMutation({
        mutationFn: async () => {
            const payload = { authorizationToken: authToken, reason };
            return deletionMode === "immediate" 
                ? apiClient.post("/account/delete/confirm", payload)
                : apiClient.post("/account/delete/schedule", { ...payload, days: scheduleDays });
        },
        onSuccess: (response) => {
            setShowConfirmDialog(false);
            queryClient.invalidateQueries({ queryKey: ["deletion-status"] });
            if (deletionMode === "immediate") {
                toast({ title: t(ProfileMessages.ACCOUNT_DELETED_SUCCESS), description: t(ProfileMessages.ACCOUNT_DELETED_DESC) });
                setTimeout(() => logout(), 2000);
            } else {
                toast({ title: t(ProfileMessages.DELETION_SCHEDULED_SUCCESS), description: t(ProfileMessages.DELETION_SCHEDULED_DESC, { date: new Date(response.data.scheduledFor).toLocaleDateString() }) });
                navigate("/profile");
            }
        },
        onError: (error: any) => {
            toast({ title: t(ProfileMessages.DELETION_FAILED), description: error.response?.data?.error || t(ErrorMessages.AUTH_ERROR_OCCURRED), variant: "destructive" });
        },
    });

    const cancelDeletionMutation = useMutation({
        mutationFn: async () => apiClient.post("/account/delete/cancel"),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["deletion-status"] });
            toast({ title: t(ProfileMessages.DELETION_CANCELLED_SUCCESS), description: t(ProfileMessages.DELETION_CANCELLED_DESC) });
        },
        onError: (error: any) => {
            toast({ title: t(ProfileMessages.CANCEL_DELETION_FAILED), description: error.response?.data?.error || t(ErrorMessages.AUTH_ERROR_OCCURRED), variant: "destructive" });
        },
    });

    return {
        t, user, navigate,
        step, setStep,
        otp, setOtp,
        deletionMode, setDeletionMode,
        scheduleDays, setScheduleDays,
        reason, setReason,
        showConfirmDialog, setShowConfirmDialog,
        eligibility, eligibilityLoading, refetchEligibility,
        deletionStatus,
        requestOtpMutation,
        verifyOtpMutation,
        confirmDeletionMutation,
        cancelDeletionMutation,
    };
};
