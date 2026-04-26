import { Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useTranslation } from "react-i18next";
import { ProfileMessages } from "@/shared/constants/messages/ProfileMessages";

interface OtpVerificationViewProps {
    email?: string;
    otp: string;
    onOtpChange: (val: string) => void;
    onVerify: () => void;
    onResend: () => void;
    isVerifying: boolean;
    isResending: boolean;
}

export const OtpVerificationView = ({ email, otp, onOtpChange, onVerify, onResend, isVerifying, isResending }: OtpVerificationViewProps) => {
    const { t } = useTranslation();

    return (
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="p-8 border-b">
                <CardTitle className="text-2xl font-bold text-[#2C1810]">{t(ProfileMessages.VERIFY_IDENTITY)}</CardTitle>
                <CardDescription>{t(ProfileMessages.ENTER_CODE, { email })}</CardDescription>
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
                        onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="text-center text-2xl tracking-widest h-14"
                        maxLength={6}
                    />
                </div>
                <Button className="w-full h-14 rounded-xl bg-[#2C1810] hover:bg-[#B85C3C]" onClick={onVerify} disabled={otp.length !== 6 || isVerifying}>
                    {isVerifying && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
                    {t(ProfileMessages.VERIFY_CODE)}
                </Button>
                <Button variant="ghost" className="w-full" onClick={onResend} disabled={isResending}>{t(ProfileMessages.RESEND_CODE)}</Button>
            </CardContent>
        </Card>
    );
};
