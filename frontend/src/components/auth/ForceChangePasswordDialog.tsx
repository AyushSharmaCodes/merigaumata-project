import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { getErrorMessage } from "@/lib/errorUtils";
import { useTranslation } from "react-i18next";

export function ForceChangePasswordDialog() {
    const { user, updateUser } = useAuthStore();
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const { toast } = useToast();
    const { t } = useTranslation();

    useEffect(() => {
        if (user?.mustChangePassword) {
            setOpen(true);
        } else {
            setOpen(false);
        }
    }, [user?.mustChangePassword]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            toast({
                title: t("common.error"),
                description: t("auth.forceChangePassword.errorMinLength"),
                variant: "destructive"
            });
            return;
        }

        if (password !== confirmPassword) {
            toast({
                title: t("common.error"),
                description: t("auth.forceChangePassword.errorMatch"),
                variant: "destructive"
            });
            return;
        }

        setLoading(true);
        try {
            await apiClient.post('/profile/change-password', { newPassword: password });

            updateUser({ mustChangePassword: false });
            setOpen(false);

            toast({
                title: t("common.success"),
                description: t("auth.forceChangePassword.success")
            });

            // Clear form
            setPassword("");
            setConfirmPassword("");
        } catch (error: unknown) {
            toast({
                title: t("auth.forceChangePassword.errorFailed"),
                description: getErrorMessage(error, t, "common.errorOccurred"),
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    // Prevent closing without updating
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen && user?.mustChangePassword) {
            return;
        }
        setOpen(newOpen);
    };

    if (!user?.mustChangePassword) return null;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="sm:max-w-md"
                onPointerDownOutside={e => e.preventDefault()}
                onEscapeKeyDown={e => e.preventDefault()}
            // Hide close button via CSS or if className allows hacking it, but ideally we should be robust
            // Typically shadcn dialog has a Close component usage internally.
            >
                <DialogHeader>
                    <DialogTitle>{t("auth.forceChangePassword.title")}</DialogTitle>
                    <DialogDescription>
                        {t("auth.forceChangePassword.description")}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-password">{t("auth.forceChangePassword.newPassword")}</Label>
                        <div className="relative">
                            <Input
                                id="new-password"
                                autoComplete="new-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder={t("auth.forceChangePassword.placeholderNew")}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">{t("auth.forceChangePassword.confirmPassword")}</Label>
                        <div className="relative">
                            <Input
                                id="confirm-password"
                                autoComplete="new-password"
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                placeholder={t("auth.forceChangePassword.placeholderConfirm")}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? t("auth.forceChangePassword.updating") : t("auth.forceChangePassword.submit")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
