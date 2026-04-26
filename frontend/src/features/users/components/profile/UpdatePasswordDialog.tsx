import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from "@/shared/components/ui/input-otp";
import { Loader2, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useUpdatePassword } from "../../hooks/useUpdatePassword";

interface UpdatePasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isGoogleAuth?: boolean;
}

export function UpdatePasswordDialog({
    open,
    onOpenChange,
    isGoogleAuth = false,
}: UpdatePasswordDialogProps) {
    const {
        form,
        loading,
        otpSent,
        setOtpSent,
        showCurrentPassword,
        setShowCurrentPassword,
        showNewPassword,
        setShowNewPassword,
        showConfirmPassword,
        setShowConfirmPassword,
        handleSendOTP,
        onSubmit,
        handleOpenChange,
        t,
    } = useUpdatePassword({ onOpenChange });

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent 
                className="sm:max-w-[520px] rounded-[2.5rem] border border-border shadow-2xl p-0 overflow-hidden bg-card text-card-foreground"
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <div className="relative overflow-hidden group">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <pattern id="mandala-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                                    <path d="M50 0 L100 50 L50 100 L0 50 Z" fill="currentColor" />
                                    <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="2" />
                                    <path d="M25 25 L75 75 M75 25 L25 75" stroke="currentColor" strokeWidth="1" />
                                </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#mandala-pattern)" />
                        </svg>
                    </div>

                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary/60 to-primary" />

                    <div className="relative bg-gradient-to-br from-primary/5 via-card to-primary/2 p-6 sm:p-10 border-b border-border/50">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.07] pointer-events-none">
                            <LockKeyhole className="w-24 h-24 rotate-12 text-primary" />
                        </div>
                        <DialogHeader className="relative z-10 text-left">
                            <div className="inline-flex items-center gap-2 mb-2">
                                <span className="h-px w-8 bg-primary/40" />
                                <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary/70">{t('profile.personalInfo.passwordUpdate.securityVeil')}</span>
                            </div>
                            <DialogTitle className="text-3xl font-playfair tracking-tight text-primary sm:text-4xl">
                                {isGoogleAuth
                                    ? t("profile.personalInfo.passwordUpdate.googleAuth.title")
                                    : (otpSent
                                        ? t("profile.personalInfo.passwordUpdate.titleOtp")
                                        : t("profile.personalInfo.passwordUpdate.title"))
                                }
                            </DialogTitle>
                            <DialogDescription className="text-sm font-medium text-muted-foreground mt-3 max-w-[90%] leading-relaxed">
                                {isGoogleAuth
                                    ? t("profile.personalInfo.passwordUpdate.googleAuth.description")
                                    : (otpSent
                                        ? t("profile.personalInfo.passwordUpdate.descriptionOtp")
                                        : t("profile.personalInfo.passwordUpdate.description"))
                                }
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                </div>

                <div className="p-6 sm:p-10 bg-card">
                    {isGoogleAuth ? (
                        <div className="text-center space-y-6 py-4">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 border border-border mb-2 shadow-inner">
                                <svg className="w-10 h-10 text-primary/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                    {t("profile.personalInfo.passwordUpdate.googleAuth.message1")}
                                </p>
                                <p className="text-[13px] text-muted-foreground/60 leading-relaxed italic">
                                    {t("profile.personalInfo.passwordUpdate.googleAuth.message2")}
                                    <span className="text-primary font-bold mx-1">"{t("profile.personalInfo.passwordUpdate.googleAuth.forgotPassword")}"</span>
                                    {t("profile.personalInfo.passwordUpdate.googleAuth.message3")}
                                    {t("profile.personalInfo.passwordUpdate.googleAuth.message4")}
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                className="mt-4 rounded-full px-10 h-11 border-border text-foreground font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-muted"
                                onClick={() => onOpenChange(false)}
                            >
                                {t("profile.personalInfo.passwordUpdate.googleAuth.gotIt")}
                            </Button>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                {!otpSent ? (
                                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        {[
                                            { name: "currentPassword", label: "currentPassword", show: showCurrentPassword, setShow: setShowCurrentPassword, placeholder: "current" },
                                            { name: "newPassword", label: "newPassword", show: showNewPassword, setShow: setShowNewPassword, placeholder: "new" },
                                            { name: "confirmPassword", label: "confirmPassword", show: showConfirmPassword, setShow: setShowConfirmPassword, placeholder: "confirm" }
                                        ].map((item) => (
                                            <FormField
                                                key={item.name}
                                                control={form.control}
                                                name={item.name as any}
                                                render={({ field }) => (
                                                    <FormItem className="space-y-1">
                                                        <FormLabel className="text-[11px] font-bold text-[#3d2b1f]/80 ml-1">
                                                            {t(`profile.personalInfo.passwordUpdate.${item.label}`)}
                                                        </FormLabel>
                                                        <FormControl>
                                                            <div className="relative group/input">
                                                                <Input
                                                                    type={item.show ? "text" : "password"}
                                                                    placeholder={t(`profile.personalInfo.passwordUpdate.placeholders.${item.placeholder}`)}
                                                                    className="h-12 rounded-2xl border-border bg-muted/30 focus:bg-background focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-300 pr-12 text-sm text-foreground"
                                                                    {...field}
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-muted text-muted-foreground/30 hover:text-foreground transition-colors"
                                                                    onClick={() => item.setShow(!item.show)}
                                                                >
                                                                    {item.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                                </Button>
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage className="text-[11px] font-medium text-red-400/80 ml-1" />
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-8 py-4 animate-in zoom-in-95 fade-in duration-500">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center border border-primary/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                                <LockKeyhole className="h-9 w-9 text-primary animate-pulse" />
                                            </div>
                                            <div className="text-center space-y-1">
                                                <h4 className="text-primary font-bold text-[10px] uppercase tracking-[0.3em]">{t('profile.personalInfo.passwordUpdate.validationRequired')}</h4>
                                                <p className="text-xs text-muted-foreground">{t("profile.personalInfo.passwordUpdate.didntReceive")}</p>
                                            </div>
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="otp"
                                            render={({ field }) => (
                                                <FormItem className="space-y-4">
                                                    <FormControl>
                                                        <div className="flex justify-center scale-110 sm:scale-125 py-4">
                                                            <InputOTP
                                                                maxLength={6}
                                                                value={field.value}
                                                                onChange={field.onChange}
                                                                className="gap-3"
                                                                autoFocus
                                                            >
                                                                <InputOTPGroup className="gap-2">
                                                                    {[0, 1, 2].map((i) => (
                                                                        <InputOTPSlot key={i} index={i} className="h-12 w-10 sm:h-14 sm:w-12 rounded-xl border-border bg-muted text-lg font-bold text-primary focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all" />
                                                                    ))}
                                                                </InputOTPGroup>
                                                                <InputOTPSeparator className="text-border mx-1" />
                                                                <InputOTPGroup className="gap-2">
                                                                    {[3, 4, 5].map((i) => (
                                                                        <InputOTPSlot key={i} index={i} className="h-12 w-10 sm:h-14 sm:w-12 rounded-xl border-border bg-muted text-lg font-bold text-primary focus:ring-4 focus:ring-primary/10 focus:border-primary shadow-sm transition-all" />
                                                                    ))}
                                                                </InputOTPGroup>
                                                            </InputOTP>
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage className="text-center text-[11px] font-medium" />
                                                </FormItem>
                                            )}
                                        />

                                        <div className="flex justify-center">
                                            <Button
                                                type="button"
                                                variant="link"
                                                className="h-auto text-primary text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 hover:no-underline hover:text-primary-hover transition-colors"
                                                onClick={handleSendOTP}
                                                disabled={loading}
                                            >
                                                {loading && <Loader2 className="h-3 w-3 animate-spin" />}
                                                {t("profile.personalInfo.passwordUpdate.resendOtp")}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-8 border-t border-dashed border-border mt-6">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            if (otpSent) {
                                                setOtpSent(false);
                                                form.clearErrors("otp");
                                            } else {
                                                handleOpenChange(false);
                                            }
                                        }}
                                        disabled={loading}
                                        className="w-full sm:w-auto h-12 rounded-full px-8 font-bold text-[10px] uppercase tracking-[0.25em] border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-95 shadow-sm"
                                    >
                                        {otpSent ? t("common.back") : t("common.cancel")}
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full sm:w-auto h-12 rounded-full bg-gradient-to-r from-primary to-primary-hover text-primary-foreground px-12 font-bold text-[10px] uppercase tracking-[0.25em] shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-500"
                                    >
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {otpSent ? t("profile.personalInfo.passwordUpdate.verifyAndUpdate") : t("profile.personalInfo.passwordUpdate.sendOtp")}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
