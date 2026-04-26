import { useEffect, useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "@/shared/hooks/use-toast";
import confetti from "canvas-confetti";
import { CheckoutMessages } from "@/shared/constants/messages/CheckoutMessages";

interface OrderConfirmationState {
    confirmation?: {
        orderId: string;
        orderNumber?: string;
        totalAmount?: number;
        status?: string;
        showSuccessToast?: boolean;
    };
}

export const useOrderConfirmationPage = () => {
    const { id } = useParams();
    const location = useLocation();
    const { t } = useTranslation();
    const { toast } = useToast();
    const state = location.state as OrderConfirmationState | null;
    const confirmation = state?.confirmation;

    const order = useMemo(() => {
        if (!confirmation) return null;
        return {
            id: confirmation.orderId,
            order_number: confirmation.orderNumber,
            total_amount: confirmation.totalAmount,
            status: confirmation.status,
        };
    }, [confirmation]);

    useEffect(() => {
        if (confirmation?.showSuccessToast) {
            toast({
                title: t("common.success"),
                description: t(CheckoutMessages.ORDER_PLACE_SUCCESS),
            });

            window.history.replaceState(
                {
                    ...(window.history.state || {}),
                    usr: {
                        ...(window.history.state?.usr || {}),
                        confirmation: confirmation ? { ...confirmation, showSuccessToast: false } : confirmation,
                    },
                },
                document.title
            );
        }
    }, [confirmation, t, toast]);

    useEffect(() => {
        // Trigger confetti on mount
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => {
            return Math.random() * (max - min) + min;
        };

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            try {
                confetti({
                    ...defaults,
                    particleCount,
                    scalar: 1,
                    origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
                });
                confetti({
                    ...defaults,
                    particleCount,
                    scalar: 1,
                    origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
                });
            } catch (e) {
                // Suppress confetti errors
            }
        }, 250);

        return () => clearInterval(interval);
    }, []);

    return {
        order,
        id,
        t,
    };
};
