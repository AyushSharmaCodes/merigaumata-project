import { Users, Calendar, MapPin, Clock, Shield, Sparkles, XCircle, Info, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import type { Event } from "@/shared/types";

interface EventSidebarProps {
  event: Event;
  formatAmount: (amount: number) => string;
  formatDateTime: (date: any, time?: string) => string;
  formatTime: (time: string) => string;
  handleRegister: () => void;
  isEventFull: boolean;
  slotsRemaining: number | null;
  scheduleLabel: string;
  scheduleSummary: string;
  scheduleDetail: string[];
}

export const EventSidebar = ({
  event,
  formatAmount,
  formatDateTime,
  formatTime,
  handleRegister,
  isEventFull,
  slotsRemaining,
  scheduleLabel,
  scheduleSummary,
  scheduleDetail,
}: EventSidebarProps) => {
  const { t } = useTranslation();
  const registrationAmount = event.registrationAmount || 0;
  const isFree = registrationAmount === 0;
  const showRegistration = event.isRegistrationEnabled !== false;
  const hasCapacity = event.capacity != null && event.capacity > 0;
  const currentRegistrations = event.registrations || 0;

  return (
    <div className="lg:sticky lg:top-24">
      <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white animate-in slide-in-from-right-8 duration-1000">
        <CardHeader className="p-6 sm:p-8 pb-4 border-b border-[#FAF7F2]">
          <div className="flex justify-between items-center mb-6">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B85C3C]">{t("common.info")}</p>
              <h3 className="text-2xl font-bold text-[#2C1810] font-playfair">{t("events.registration.title")}</h3>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 sm:p-8 space-y-6 sm:space-y-8">
          {showRegistration && (
            <div className="p-6 rounded-3xl bg-[#FAF7F2] border border-[#B85C3C]/10 flex flex-col items-center text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{t("events.public.details.passContribution")}</p>
              <p className="text-4xl font-black text-[#2C1810]">
                {isFree ? t("events.public.details.entryFree") : formatAmount(registrationAmount)}
              </p>
              {!isFree && (
                <div className="mt-2 space-y-1">
                  <p className="text-[10px] text-[#B85C3C] font-bold uppercase tracking-tighter">
                    {t("events.public.details.taxInclusive")}
                  </p>
                  <div className="flex flex-col text-[10px] text-muted-foreground/80 font-medium">
                    <span>{t("events.registration.basePrice")}: {formatAmount(event.basePrice || (registrationAmount / (1 + (event.gstRate || 0) / 100)))}</span>
                    <span>{t("events.registration.gst")} ({event.gstRate || 0}%): {formatAmount(event.gstAmount || (registrationAmount - (registrationAmount / (1 + (event.gstRate || 0) / 100))))}</span>
                  </div>
                </div>
              )}
              {isFree && hasCapacity && (
                <p className="text-[10px] text-[#B85C3C] mt-2 font-bold uppercase tracking-tighter">
                  {t("events.public.details.limitedSlots")}
                </p>
              )}
            </div>
          )}

          {hasCapacity && (
            <div className={`p-4 rounded-2xl border flex gap-3 items-center ${isEventFull ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
              <Users className={`h-5 w-5 flex-shrink-0 ${isEventFull ? 'text-red-500' : 'text-emerald-600'}`} />
              <div>
                <p className={`text-xs font-bold ${isEventFull ? 'text-red-700' : 'text-emerald-700'}`}>
                  {isEventFull
                    ? t("events.public.details.eventFull")
                    : t(`events.public.details.slotsRemaining_${(slotsRemaining ?? 0) === 1 ? "one" : "other"}`, { count: slotsRemaining ?? 0 })}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {currentRegistrations} / {event.capacity} {t("events.public.details.registered")}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-start gap-3 sm:gap-4 rounded-2xl border border-[#F1E8DE] bg-[#FCFAF7] p-4 sm:p-5 group">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white flex shrink-0 items-center justify-center text-[#B85C3C] shadow-sm group-hover:bg-[#B85C3C] group-hover:text-white transition-all">
                <Calendar size={20} />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{scheduleLabel}</p>
                <p className="text-base font-bold text-[#2C1810] leading-snug break-words">{scheduleSummary}</p>
                {scheduleDetail.map((line, idx) => (
                  <p key={idx} className="text-sm font-medium text-muted-foreground leading-relaxed break-words">{line}</p>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-3 sm:gap-4 rounded-2xl border border-[#F1E8DE] bg-[#FCFAF7] p-4 sm:p-5 group">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white flex shrink-0 items-center justify-center text-[#B85C3C] shadow-sm group-hover:bg-[#B85C3C] group-hover:text-white transition-all">
                <MapPin size={20} />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("admin.events.management.table.location")}</p>
                <p className="text-base font-bold text-[#2C1810] leading-snug break-words">{event.location?.address}</p>
              </div>
            </div>

            {event.registrationDeadline && (
              <div className="flex items-start gap-3 sm:gap-4 rounded-2xl border border-orange-100 bg-orange-50/50 p-4 sm:p-5 group">
                <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white flex shrink-0 items-center justify-center text-orange-600 shadow-sm group-hover:bg-orange-600 group-hover:text-white transition-all">
                  <Clock size={20} />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("events.public.details.deadline")}</p>
                  <p className="text-base font-bold text-[#2C1810] leading-snug break-words">{formatDateTime(event.registrationDeadline)}</p>
                  <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                    {t("events.public.details.registrationCloses")}
                  </p>
                </div>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100/50 flex gap-3 items-start">
              <Shield className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-blue-900 text-[10px] font-bold uppercase tracking-wider">{t("events.public.details.policy")}</p>
                <p className="text-blue-700 text-[10px] leading-relaxed font-medium">
                  {isFree ? t("events.public.details.policyFree") : t("events.public.details.policyPaid")}
                </p>
              </div>
            </div>
          </div>

          {showRegistration && (event.status === "upcoming" || event.status === "ongoing") && (
            <Button
              onClick={handleRegister}
              disabled={isEventFull}
              className={`w-full rounded-2xl py-8 text-lg font-bold transition-all duration-500 shadow-xl h-auto ${
                isEventFull
                  ? 'bg-muted text-muted-foreground cursor-not-allowed shadow-none'
                  : 'bg-[#B85C3C] hover:bg-[#2C1810] shadow-[#B85C3C]/20 hover:shadow-[#2C1810]/20'
              }`}
            >
              {isEventFull ? (
                <><Users size={20} className="mr-2" />{t("events.public.details.eventFull")}</>
              ) : (
                <><Sparkles size={20} className="mr-2" />{t("events.public.details.registerNow")}</>
              )}
            </Button>
          )}

          {event.status === 'cancelled' && (
            <div className="space-y-4">
              <div className="p-6 rounded-3xl bg-red-50 border border-red-100 text-center">
                <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
                <h4 className="text-red-900 font-bold">{t("events.bookingUnavailable")}</h4>
                <p className="text-red-700 text-xs mt-2 font-medium">{t("events.gatheringCancelled")}</p>
              </div>

              {!isFree && (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex gap-3 items-start">
                  <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-blue-900 text-xs font-bold uppercase">{t("events.public.details.refundPolicy")}</p>
                    <p className="text-blue-700 text-[10px] leading-relaxed">
                      {t("events.public.details.refundDesc")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {event.status === "completed" && (
            <div className="p-6 rounded-3xl bg-muted/30 border border-muted/50 text-center">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h4 className="text-muted-foreground font-bold">{t("events.public.details.eventCompleted")}</h4>
              <p className="text-muted-foreground/70 text-xs mt-2 font-medium">{t("events.public.details.concludedDesc")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground/60">
        <Shield size={14} className="text-green-500/50" />
        <span className="text-[10px] uppercase font-bold tracking-widest">{t("events.public.details.secureRegistration")}</span>
      </div>
    </div>
  );
};
