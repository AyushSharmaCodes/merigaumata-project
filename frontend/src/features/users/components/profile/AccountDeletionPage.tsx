import { 
    useAccountDeletion, 
    AdminProtectedView, 
    PendingDeletionView, 
    EligibilityCheckView, 
    OtpVerificationView, 
    DeletionConfirmationView 
} from "@/features/auth";
import { AlertTriangle } from "lucide-react";
import { BackButton } from "@/shared/components/ui/BackButton";
import { ProfileMessages } from "@/shared/constants/messages/ProfileMessages";

export const AccountDeletionPage = () => {
    const {
        t, user,
        step, setStep,
        otp, setOtp,
        deletionMode, setDeletionMode,
        scheduleDays,
        reason, setReason,
        showConfirmDialog, setShowConfirmDialog,
        eligibility, eligibilityLoading, refetchEligibility,
        deletionStatus,
        requestOtpMutation,
        verifyOtpMutation,
        confirmDeletionMutation,
        cancelDeletionMutation,
    } = useAccountDeletion();

    if (user?.role === 'admin') return <AdminProtectedView />;

    if (deletionStatus?.status === "PENDING_DELETION") {
        return (
            <PendingDeletionView 
                scheduledFor={deletionStatus.scheduledFor!} 
                isPending={cancelDeletionMutation.isPending} 
                onCancel={() => cancelDeletionMutation.mutate()} 
            />
        );
    }

    return (
        <div className="min-h-screen bg-[#FAF7F2]/30 py-12">
            <div className="container mx-auto px-4 max-w-2xl">
                <BackButton className="mb-8" />

                <div className="mb-8 p-6 bg-red-50 border border-red-200 rounded-2xl">
                    <div className="flex items-start gap-4">
                        <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                        <div>
                            <h2 className="font-bold text-red-900">{t(ProfileMessages.PERMANENT_DELETION)}</h2>
                            <p className="text-sm text-red-700 mt-1">{t(ProfileMessages.ACTION_UNDONE)}</p>
                        </div>
                    </div>
                </div>

                {step === "check" && (
                    <EligibilityCheckView 
                        eligibility={eligibility} 
                        isLoading={eligibilityLoading} 
                        onRefresh={refetchEligibility} 
                        onRequestOtp={() => requestOtpMutation.mutate()} 
                        isOtpPending={requestOtpMutation.isPending}
                    />
                )}

                {step === "otp" && (
                    <OtpVerificationView 
                        email={user?.email} 
                        otp={otp} 
                        onOtpChange={setOtp} 
                        onVerify={() => verifyOtpMutation.mutate(otp)} 
                        onResend={() => requestOtpMutation.mutate()} 
                        isVerifying={verifyOtpMutation.isPending} 
                        isResending={requestOtpMutation.isPending}
                    />
                )}

                {step === "confirm" && (
                    <DeletionConfirmationView 
                        deletionMode={deletionMode} 
                        onModeChange={setDeletionMode} 
                        scheduleDays={scheduleDays} 
                        reason={reason} 
                        onReasonChange={setReason} 
                        onSubmit={() => setShowConfirmDialog(true)} 
                        showDialog={showConfirmDialog} 
                        onDialogChange={setShowConfirmDialog} 
                        onConfirm={() => confirmDeletionMutation.mutate()} 
                        isConfirming={confirmDeletionMutation.isPending}
                    />
                )}
            </div>
        </div>
    );
};

