import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface LoadingOverlayProps {
    isLoading: boolean;
    message?: string;
    className?: string;
}

/**
 * Full-page loading overlay component
 * Uses React Portal to render at the top level of the DOM to avoid layout shifts
 * Displays a centered spinner with optional message
 * Covers the entire viewport with a semi-transparent backdrop
 */
export function LoadingOverlay({
    isLoading,
    message,
    className
}: LoadingOverlayProps) {
    const { t } = useTranslation();
    const displayMessage = message || t("common.loading");

    if (!isLoading) return null;

    const content = (
        <div
            className={cn(
                "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/60 backdrop-blur-md animate-in fade-in duration-300",
                className
            )}
        >
            <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white shadow-[0_20px_50px_rgba(184,92,60,0.1)] border border-[#B85C3C]/10 animate-in zoom-in-95 duration-300">
                <Loader2 className="h-10 w-10 animate-spin text-[#B85C3C] stroke-[2]" />
                <p className="text-base font-semibold text-[#2C1810] tracking-tight">{displayMessage}</p>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}

/**
 * Relative loading overlay - for use within a container
 * Parent should have `position: relative`
 */
export function LoadingOverlayRelative({
    isLoading,
    message,
    className
}: LoadingOverlayProps) {
    const { t } = useTranslation();
    const displayMessage = message || t("common.loading");

    if (!isLoading) return null;

    return (
        <div
            className={cn(
                "absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/40 backdrop-blur-[2px] rounded-lg animate-in fade-in duration-200",
                className
            )}
        >
            <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-80" />
                <p className="text-sm font-medium text-muted-foreground">{displayMessage}</p>
            </div>
        </div>
    );
}
