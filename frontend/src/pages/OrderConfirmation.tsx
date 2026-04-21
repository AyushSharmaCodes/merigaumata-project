import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Package, Home, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import { useToast } from "@/hooks/use-toast";
import { CheckoutMessages } from "@/constants/messages/CheckoutMessages";

interface OrderConfirmationState {
    confirmation?: {
        orderId: string;
        orderNumber?: string;
        totalAmount?: number;
        status?: string;
        showSuccessToast?: boolean;
    };
}

export default function OrderConfirmation() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
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
            // Use scalar to avoid SVG dimension warnings
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

    if (!order && !id) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">{t("orderConfirmation.notFound")}</h2>
                    <Button onClick={() => navigate("/")}>{t("orderConfirmation.goHome")}</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30 py-12 px-4">
            <div className="max-w-2xl mx-auto space-y-8">
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 text-green-600 mb-4">
                        <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <h1 className="text-4xl font-bold text-foreground">{t("orderConfirmation.confirmedTitle")}</h1>
                    <p className="text-muted-foreground text-lg">
                        {t("orderConfirmation.confirmedDesc")}
                    </p>
                    {order?.order_number && (
                        <div className="inline-block bg-background px-4 py-2 rounded-lg border border-border shadow-sm">
                            <span className="text-sm text-muted-foreground mr-2">{t("orderConfirmation.orderId")}:</span>
                            <span className="font-mono font-medium">{order.order_number}</span>
                        </div>
                    )}
                </div>

                <Card className="border-t-4 border-t-primary">
                    <CardHeader>
                        <CardTitle>{t("orderConfirmation.whatNext")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex gap-4">
                            <div className="bg-primary/10 p-3 rounded-full h-fit">
                                <Package className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-medium mb-1">{t("orderConfirmation.processingTitle")}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {t("orderConfirmation.processingDesc")}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="bg-primary/10 p-3 rounded-full h-fit">
                                <Home className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-medium mb-1">{t("orderConfirmation.deliveryTitle")}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {t("orderConfirmation.deliveryDesc")}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button asChild variant="outline" className="h-12 px-8">
                        <Link to="/">
                            <Home className="mr-2 h-4 w-4" />
                            {t("orderConfirmation.returnHome")}
                        </Link>
                    </Button>
                    <Button asChild className="h-12 px-8">
                        <Link to="/my-orders">
                            {t("orderConfirmation.viewOrders")}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
