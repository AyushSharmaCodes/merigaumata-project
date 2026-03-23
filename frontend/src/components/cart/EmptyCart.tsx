import { useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export const EmptyCart = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-700">
            <div className="relative mb-10 group">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all duration-700 scale-150" />
                <div className="relative w-40 h-40 bg-card border border-border/40 rounded-full flex items-center justify-center shadow-2xl transition-transform duration-700 hover:scale-105 hover:rotate-2">
                    <ShoppingBag className="w-16 h-16 text-primary animate-pulse" />
                </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-black mb-4 font-playfair tracking-tighter text-foreground">
                {t("cart.emptyTitle")}
            </h1>

            <p className="text-muted-foreground max-w-sm mb-12 text-sm md:text-base leading-relaxed font-medium px-4">
                {t("cart.emptyDescription")}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <Button
                    onClick={() => navigate("/shop")}
                    size="lg"
                    className="text-base font-black uppercase tracking-widest px-10 py-7 h-auto rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-1 active:scale-95"
                >
                    {t("cart.startShopping")}
                </Button>
                <Button
                    variant="outline"
                    onClick={() => navigate("/")}
                    size="lg"
                    className="text-base font-black uppercase tracking-widest px-10 py-7 h-auto rounded-2xl bg-background/50 backdrop-blur-sm border-border/60 hover:bg-muted transition-all"
                >
                    {t("cart.backToHome")}
                </Button>
            </div>
        </div>
    );
};
