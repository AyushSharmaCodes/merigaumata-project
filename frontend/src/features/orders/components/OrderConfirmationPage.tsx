import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { CheckCircle2, Package, Home, ArrowRight } from "lucide-react";
import { useOrderConfirmationPage } from "../hooks/useOrderConfirmationPage";

export const OrderConfirmationPage = () => {
    const navigate = useNavigate();
    const { order, id, t } = useOrderConfirmationPage();

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
};
