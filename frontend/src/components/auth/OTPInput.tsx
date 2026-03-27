import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTranslation } from 'react-i18next';

interface OTPInputProps {
    length?: number;
    onComplete: (otp: string) => void;
    onResend: () => void;
    identifier: string;
    expirySeconds?: number;
    forceEnableResend?: boolean;
}

export function OTPInput({
    length = 6,
    onComplete,
    onResend,
    identifier,
    expirySeconds = 300, // 5 minutes default
    forceEnableResend = false,
}: OTPInputProps) {
    const { t } = useTranslation();
    const [otp, setOtp] = useState<string[]>(new Array(length).fill(""));
    const [timeLeft, setTimeLeft] = useState(expirySeconds);
    const [isResending, setIsResending] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown timer
    useEffect(() => {
        if (timeLeft <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft]);

    // Format time as MM:SS
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const handleChange = (index: number, value: string) => {
        // Only allow digits
        if (value && !/^\d$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-validate on last digit
        if (value && index === length - 1) {
            const fullOtp = newOtp.join("");
            if (fullOtp.length === length) {
                onComplete(fullOtp);
            }
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        // Handle backspace
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }

        // Handle paste
        if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            navigator.clipboard.readText().then((text) => {
                const digits = text.replace(/\D/g, "").slice(0, length);
                const newOtp = [...otp];

                for (let i = 0; i < digits.length; i++) {
                    newOtp[i] = digits[i];
                }

                setOtp(newOtp);

                // Focus last filled input or next empty
                const lastIndex = Math.min(digits.length, length - 1);
                inputRefs.current[lastIndex]?.focus();

                // Auto-validate if complete
                if (digits.length === length) {
                    onComplete(digits);
                }
            });
        }
    };

    const handleResend = async () => {
        setIsResending(true);
        try {
            await onResend();
            setOtp(new Array(length).fill(""));
            setTimeLeft(expirySeconds);
            inputRefs.current[0]?.focus();
            toast.success(t('auth.otp.resentSuccess', { defaultValue: 'OTP resent successfully' }));
        } catch (error) {
            toast.error(t('auth.otp.resentFailed', { defaultValue: 'Failed to resend OTP' }));
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* OTP Input Boxes */}
            <div className="flex justify-center gap-2">
                {otp.map((digit, index) => (
                    <Input
                        key={index}
                        id={`otp-input-digit-${index + 1}`}
                        name={`otp-input-digit-${index + 1}`}
                        aria-label={`OTP digit ${index + 1}`}
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className="w-12 h-12 text-center text-lg font-semibold"
                        autoFocus={index === 0}
                    />
                ))}
            </div>

            {/* Timer and Resend */}
            <div className="text-center space-y-2">
                {timeLeft > 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t('auth.otp.expiresIn', { defaultValue: 'Code expires in' })}{" "}
                        <span className="font-semibold text-foreground">
                            {formatTime(timeLeft)}
                        </span>
                    </p>
                ) : (
                    <p className="text-sm text-destructive">{t('auth.otp.expired', { defaultValue: 'OTP expired' })}</p>
                )}

                <div className="flex items-center justify-center gap-2">
                    <p className="text-sm text-muted-foreground">{t('auth.otp.didntReceive')}</p>
                    <Button
                        variant="link"
                        size="sm"
                        onClick={handleResend}
                        disabled={!forceEnableResend && (isResending || timeLeft > expirySeconds - 30)} // Allow resend after 30 seconds OR if forced
                        className="h-auto p-0 text-primary"
                    >
                        {isResending ? t('auth.otp.sending', { defaultValue: 'Sending...' }) : t('auth.otp.resend', { defaultValue: 'Resend OTP' })}
                    </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                    {t('auth.otp.sentTo', { defaultValue: 'Sent to' })} {identifier}
                </p>
            </div>
        </div>
    );
}
