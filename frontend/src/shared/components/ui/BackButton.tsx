import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "./button";
import { cn } from "@/core/utils/utils";
import { useTranslation } from "react-i18next";

interface BackButtonProps {
    to?: string;
    label?: string;
    className?: string;
    variant?: "pill" | "ghost";
    showIcon?: boolean;
    onClick?: () => void;
}

export const BackButton = ({
    to,
    label,
    className,
    variant = "pill",
    showIcon = true,
    onClick,
}: BackButtonProps) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const displayLabel = label || t("common.back", "Back");

    const handleBack = () => {
        if (onClick) {
            onClick();
            return;
        }
        if (to) {
            navigate(to);
        } else {
            navigate(-1);
        }
    };

    if (variant === "pill") {
        return (
            <Button
                onClick={handleBack}
                className={cn(
                    "group rounded-full px-6 py-2.5 bg-[#2C1810] text-white hover:bg-[#1A0E09] shadow-md hover:shadow-lg transition-all duration-300 font-semibold border border-[#2C1810]/10 shrink-0",
                    className
                )}
            >
                {showIcon && (
                    <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
                )}
                <span className="text-sm uppercase tracking-wider">{displayLabel}</span>
            </Button>
        );
    }

    return (
        <Button
            variant="ghost"
            onClick={handleBack}
            className={cn(
                "group flex items-center gap-2 text-muted-foreground hover:text-[#2C1810] hover:bg-transparent p-0 transition-colors h-auto shrink-0",
                className
            )}
        >
            {showIcon && (
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            )}
            <span className="text-sm font-medium">{displayLabel}</span>
        </Button>
    );
};
