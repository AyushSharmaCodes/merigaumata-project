import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, Sparkles, ShoppingCart } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

export const MyOrdersHero = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="bg-[#2C1810] text-white py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-30"></div>
      <div className="absolute -right-20 -top-20 w-80 h-80 bg-[#B85C3C] rounded-full blur-[120px] opacity-20"></div>
      <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-[#B85C3C] rounded-full blur-[120px] opacity-10"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B85C3C]/20 border border-[#B85C3C]/30 text-[#B85C3C] text-xs font-bold uppercase tracking-widest animate-in fade-in slide-in-from-left duration-500">
              <Sparkles className="h-3.5 w-3.5" /> {t("myOrders.badge")}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-playfair font-bold text-white leading-tight animate-in fade-in slide-in-from-left duration-700 delay-100">
              {(() => {
                const titleParts = t("myOrders.title").split(" ");
                if (titleParts.length < 3) return t("myOrders.title");
                return (
                  <>
                    {titleParts[0]} {titleParts[1]} <span className="text-[#B85C3C]">{titleParts.slice(2).join(" ")}</span>
                  </>
                );
              })()}
            </h1>
            <nav className="flex items-center gap-2 text-sm text-white/60 animate-in fade-in slide-in-from-left duration-700 delay-200 font-medium tracking-wide">
              <span>{t("myOrders.home")}</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-white">{t("myOrders.orderHistory")}</span>
            </nav>
          </div>
          <Button
            onClick={() => navigate("/shop")}
            className="w-full md:w-auto bg-[#B85C3C] hover:bg-white hover:text-[#2C1810] text-white font-bold text-xs uppercase tracking-widest px-8 h-12 rounded-full shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-right duration-700 delay-300"
          >
            {t("myOrders.returnToShop")} <ShoppingCart className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
