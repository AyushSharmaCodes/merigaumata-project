import { Sparkles, User, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackButton } from "@/shared/components/ui/BackButton";
import { Tag } from "@/shared/components/ui/Tag";
import type { Event } from "@/shared/types";

interface EventHeroProps {
  event: Event;
  getStatusVariant: (status: Event["status"]) => any;
}

export const EventHero = ({ event, getStatusVariant }: EventHeroProps) => {
  const { t } = useTranslation();
  const isKatha = event.category === "katha";

  return (
    <section className="bg-[#2C1810] text-white pt-12 pb-24 md:pb-32 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
        <Sparkles className="h-64 w-64 text-[#B85C3C]" />
      </div>
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#B85C3C]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-7xl">
        <div className="flex flex-col gap-8 md:gap-12">
          <BackButton className="w-fit text-white/60 hover:text-white border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-300" />

          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-4 max-w-3xl">
              <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {event.category && (
                  <Tag variant="category" size="sm" className="bg-[#B85C3C]/20 text-[#D4AF37] border-[#B85C3C]/30 font-bold uppercase tracking-widest text-[10px]">
                    {t(`admin.events.categories.types.${event.category}`, { defaultValue: event.category })}
                  </Tag>
                )}
                <Tag variant={getStatusVariant(event.status)} size="sm" className="font-bold uppercase tracking-widest text-[10px]">
                  {t(`events.${event.status}`)}
                </Tag>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold font-playfair leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                {event.title}
              </h1>
              {isKatha && event.kathaVachak && (
                <p className="text-[#D4AF37] text-lg font-medium italic flex items-center gap-2 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                  <User size={18} /> {t("events.public.details.kathaVachak")}: {event.kathaVachak}
                </p>
              )}

              {event.status === 'cancelled' && event.cancellationReason && (
                <div className="mt-6 flex items-start gap-4 p-5 rounded-2xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
                  <AlertTriangle className="h-6 w-6 text-red-400 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-red-400 font-bold uppercase tracking-widest text-xs">{t("events.eventCancelled")}</p>
                    <p className="text-white/90 text-sm font-light leading-relaxed">
                      {t("admin.gallery.dialog.description")}: {event.cancellationReason}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
