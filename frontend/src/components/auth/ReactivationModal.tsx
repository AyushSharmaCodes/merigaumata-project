import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { LogOut, RefreshCcw } from "lucide-react";

export function ReactivationModal() {
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
            if (response.data.user) {
                setUser(response.data.user);
            }

            setReactivationRequired(false);

            toast({
                title: "Welcome Back!",
                description: "Your account deletion has been cancelled successfully."
            });
        } catch (error: unknown) {
            toast({
                title: "Failed to recover account",
                description: getErrorMessage(error, "An error occurred"),
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
                className="sm:max-w-md"
                onPointerDownOutside={e => e.preventDefault()}
                onEscapeKeyDown={e => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2">
                        Account Scheduled for Deletion
                    </DialogTitle>
                    <DialogDescription className="text-base py-2">
                        Your account is currently scheduled to be permanently deleted on <span className="font-semibold text-foreground">{deletionDate}</span>.
                    </DialogDescription>
                    <p className="text-sm text-muted-foreground mt-2">
                        You can recover your account now and continue using it, or log out if you still wish to proceed with the deletion.
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
                        Logout
                    </Button>
                    <Button
                        onClick={handleRecover}
                        className="w-full sm:flex-1 bg-primary hover:bg-primary/90 flex items-center justify-center gap-2"
                        disabled={loading}
                    >
                        {loading ? <RefreshCcw className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
                        Undo Deletion
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
