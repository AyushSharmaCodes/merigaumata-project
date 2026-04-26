import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ShopMessages } from "@/shared/constants/messages/ShopMessages";
import { NavMessages } from "@/shared/constants/messages/NavMessages";

export const ShopHero = () => {
  const { t } = useTranslation();

  return (
    <section className="bg-foreground text-background py-12 md:py-20 relative overflow-hidden shadow-elevated">
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <Sparkles className="h-64 w-64 text-primary" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] backdrop-blur-md border border-primary/20">
              <Sparkles className="h-3 w-3" /> {t(ShopMessages.PURE_VEDIC_BADGE)}
            </div>
            <h1 className="text-4xl md:text-6xl font-black font-playfair tracking-tight">
              {t(NavMessages.SHOP)} <span className="text-primary">{t(ShopMessages.COLLECTION)}</span>
            </h1>
          </div>
          <p className="text-background/60 text-base md:text-lg max-w-md font-medium border-l-2 border-primary/30 pl-8 hidden md:block leading-relaxed">
            {t(ShopMessages.SUBTITLE)}
          </p>
        </div>
      </div>
    </section>
  );
};
