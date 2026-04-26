import { useState } from "react";
import { useAuthStore } from "@/domains/auth";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { apiClient } from "@/core/api/api-client";
import { setAuthSession } from "@/domains/auth";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { LogOut, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ReactivationModal() {
    const { t } = useTranslation();
    const { user, isReactivationRequired, logout, setReactivationRequired, setUser } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    // Format the date
    const deletionDate = user?.scheduledDeletionAt
        ? new Date(user.scheduledDeletionAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        : "N/A";

    const handleRecover = async () => {
        setLoading(true);
        try {
            await apiClient.post('/account/delete/cancel');

            // Refresh profile from backend to ensure status is updated
            const response = await apiClient.post('/auth/refresh');
            if (response.data?.tokens) {
                setAuthSession(response.data.tokens);
            }
            if (response.data.user) {
                setUser(response.data.user);
            }

            setReactivationRequired(false);

            toast({
                title: t("auth.reactivation.successTitle", { defaultValue: "Welcome back!" }),
                description: t("auth.reactivation.successDescription", { defaultValue: "Your account deletion has been cancelled successfully." })
            });
        } catch (error: unknown) {
            toast({
                title: t("auth.reactivation.errorTitle", { defaultValue: "Failed to recover account" }),
                description: getErrorMessage(error, t, "auth.reactivation.errorDescription"),
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
    };

    if (!isReactivationRequired) return null;

    return (
        <Dialog open={isReactivationRequired} onOpenChange={() => { }}>
            <DialogContent
                className="sm:max-w-md p-0 overflow-hidden border-none shadow-premium bg-transparent"
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="text-xl flex items-center gap-2">
                        {t("auth.reactivation.dialogTitle", { defaultValue: "Account scheduled for deletion" })}
                    </DialogTitle>
                    <DialogDescription className="text-base py-2">
                        {t("auth.reactivation.dialogDescription", { defaultValue: "Your account is currently scheduled to be permanently deleted on" })} <span className="font-semibold text-foreground">{deletionDate}</span>.
                    </DialogDescription>
                    <p className="text-sm text-muted-foreground mt-2">
                        {t("auth.reactivation.dialogHelp", { defaultValue: "You can recover your account now and continue using it, or log out if you still wish to proceed with the deletion." })}
                    </p>
                </DialogHeader>

                <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-6">
                    <Button
                        variant="outline"
                        onClick={handleLogout}
                        className="w-full sm:flex-1 flex items-center justify-center gap-2"
                        disabled={loading}
                    >
                        <LogOut size={16} />
                        {t("auth.reactivation.logout", { defaultValue: "Logout" })}
                    </Button>
                    <Button
                        onClick={handleRecover}
                        className="w-full sm:flex-1 bg-primary hover:bg-primary/90 flex items-center justify-center gap-2"
                        disabled={loading}
                    >
                        {loading ? <RefreshCcw className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
                        {t("auth.reactivation.undoDeletion", { defaultValue: "Undo deletion" })}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
