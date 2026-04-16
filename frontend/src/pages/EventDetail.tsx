import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  MapPin,
  Clock,
  Banknote,
  ArrowLeft,
  User,
  Users,
  Sparkles,
  Gift,
  CheckCircle2,
  Shield,
  AlertTriangle,
  Info,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { hi, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/BackButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/Tag";
import { Separator } from "@/components/ui/separator";
import { eventService } from "@/services/event.service";
import { Event } from "@/types";
import { EventDetailSkeleton } from "@/components/ui/page-skeletons";
import { useCurrency } from "@/contexts/CurrencyContext";

const EventDetail = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { formatAmount } = useCurrency();
  const currentLocale = i18n.language === "hi" ? hi : enUS;

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId, i18n.language],
    queryFn: () => eventService.getById(eventId || ""),
    enabled: !!eventId,
  });

  const handleRegister = () => {
    if (eventId) {
      navigate(`/event/register/${eventId}`);
    }
  };

  const formatTime = (time: string) => {
    if (!time) return "";
    try {
      // Handle HH:mm:ss format from DB
      const [hours, minutes] = time.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return format(date, "h:mm a", { locale: currentLocale });
    } catch (e) {
      return time;
    }
  };

  const isSameCalendarDay = (firstDate?: string, secondDate?: string) => {
    if (!firstDate || !secondDate) return false;
    return new Date(firstDate).toDateString() === new Date(secondDate).toDateString();
  };

  const formatFullDate = (date: string) => {
    try {
      return format(new Date(date), "EEEE, MMMM d, yyyy", { locale: currentLocale });
    } catch (e) {
      return date;
    }
  };

  const formatDateTime = (date: string, time?: string) => {
    const formattedDate = formatFullDate(date);
    if (!time) return formattedDate;
    return `${formattedDate} • ${formatTime(time)}`;
  };

  if (isLoading) {
    return <EventDetailSkeleton />;
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4 font-playfair">{t("events.registration.notFound")}</h2>
          <BackButton to="/events" label={t("common.back")} />
        </div>
      </div>
    );
  }

  const eventData = event;
  const registrationAmount = eventData.registrationAmount || 0;
  const isFree = registrationAmount === 0;
  const isKatha = eventData.category === "katha";
  const showRegistration = eventData.isRegistrationEnabled !== false;
  const scheduleType = eventData.scheduleType || "single_day";
  const hasSameStartAndEndDate = isSameCalendarDay(eventData.startDate, eventData.endDate || eventData.startDate);
  const scheduleLabel = scheduleType === "multi_day_daily"
    ? t("events.public.details.dailyScheduleLabel", { defaultValue: "Daily Event Schedule" })
    : scheduleType === "multi_day_continuous"
      ? t("events.public.details.continuousScheduleLabel", { defaultValue: "Continuous Event Schedule" })
      : t("events.public.details.schedule", { defaultValue: "Event Schedule" });
  const scheduleSummary = scheduleType === "multi_day_continuous"
    ? `${formatDateTime(eventData.startDate, eventData.startTime)} ${t("events.public.details.until", { defaultValue: "until" })} ${formatDateTime(eventData.endDate || eventData.startDate, eventData.endTime)}`
    : hasSameStartAndEndDate
      ? formatFullDate(eventData.startDate)
      : `${formatFullDate(eventData.startDate)} - ${formatFullDate(eventData.endDate || eventData.startDate)}`;
  const scheduleDetail = scheduleType === "multi_day_continuous"
    ? [
        t("events.public.details.continuousHighlight", { defaultValue: "This event runs continuously and does not close at the end of each day." }),
        `${t("events.public.details.starts", { defaultValue: "Starts" })}: ${formatDateTime(eventData.startDate, eventData.startTime)}`,
        eventData.endDate
          ? `${t("events.public.details.ends", { defaultValue: "Ends" })}: ${formatDateTime(eventData.endDate, eventData.endTime)}`
          : null
      ].filter(Boolean)
    : scheduleType === "multi_day_daily"
      ? [
          t("events.public.details.dailyHighlight", { defaultValue: "This event happens on each day in the date range during the timing below." }),
          eventData.startTime && eventData.endTime
            ? t("events.public.details.dailyWindow", {
                defaultValue: "Each day: {{start}} - {{end}}",
                start: formatTime(eventData.startTime),
                end: formatTime(eventData.endTime)
              })
            : null
        ].filter(Boolean)
      : [eventData.startTime && eventData.endTime
          ? `${formatTime(eventData.startTime)} - ${formatTime(eventData.endTime)}`
          : eventData.startTime
            ? formatTime(eventData.startTime)
            : eventData.endTime
              ? formatTime(eventData.endTime)
              : null].filter(Boolean);

  // Capacity check
  const hasCapacity = eventData.capacity != null && eventData.capacity > 0;
  const currentRegistrations = eventData.registrations || 0;
  const isEventFull = hasCapacity && currentRegistrations >= eventData.capacity!;
  const slotsRemaining = hasCapacity ? Math.max(0, eventData.capacity! - currentRegistrations) : null;

  const getStatusVariant = (status: Event["status"]) => {
    switch (status) {
      case "upcoming":
        return "info" as const;
      case "ongoing":
        return "success" as const;
      case "completed":
        return "default" as const;
      case "cancelled":
        return "destructive" as const;
      default:
        return "default" as const;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]/30 pb-20">
      {/* Premium Hero Section */}
      <section className="bg-[#2C1810] text-white pt-12 pb-24 md:pb-32 relative overflow-hidden">
        {/* Background Decoration */}
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
                  {eventData.category && (
                    <Tag variant="category" size="sm" className="bg-[#B85C3C]/20 text-[#D4AF37] border-[#B85C3C]/30 font-bold uppercase tracking-widest text-[10px]">
                      {t(`admin.events.categories.types.${eventData.category}`, { defaultValue: eventData.category })}
                    </Tag>
                  )}
                  <Tag variant={getStatusVariant(eventData.status)} size="sm" className="font-bold uppercase tracking-widest text-[10px]">
                    {t(`events.${eventData.status}`)}
                  </Tag>
                </div>
                <h1 className="text-4xl md:text-6xl font-bold font-playfair leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                  {eventData.title}
                </h1>
                {isKatha && eventData.kathaVachak && (
                  <p className="text-[#D4AF37] text-lg font-medium italic flex items-center gap-2 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                    <User size={18} /> {t("events.public.details.kathaVachak")}: {eventData.kathaVachak}
                  </p>
                )}

                {eventData.status === 'cancelled' && eventData.cancellationReason && (
                  <div className="mt-6 flex items-start gap-4 p-5 rounded-2xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-300">
                    <AlertTriangle className="h-6 w-6 text-red-400 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-red-400 font-bold uppercase tracking-widest text-xs">{t("events.eventCancelled")}</p>
                      <p className="text-white/90 text-sm font-light leading-relaxed">
                        {t("admin.gallery.dialog.description")}: {eventData.cancellationReason}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl -mt-16 md:-mt-20 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column - Main Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Main Image */}
            <div className="rounded-[2.5rem] overflow-hidden shadow-2xl bg-muted aspect-[16/9] relative group animate-in fade-in zoom-in-95 duration-1000">
              <img
                src={eventData.image || "/placeholder.svg"}
                alt={eventData.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
              />
              {!eventData.image && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                  <Calendar className="h-16 w-16 mb-4 opacity-20" />
                  <p>{t("events.registration.noImage")}</p>
                </div>
              )}
            </div>

            {/* About Section */}
            <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white group hover:shadow-2xl transition-all duration-500">
              <CardHeader className="p-10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] flex items-center justify-center text-[#B85C3C]">
                    <Sparkles size={20} />
                  </div>
                  <CardTitle className="text-3xl font-bold text-[#2C1810] font-playfair">{t("events.public.details.aboutHeader")}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-10 pt-0">
                <p className="text-muted-foreground text-lg leading-relaxed whitespace-pre-line font-light">
                  {eventData.description}
                </p>
              </CardContent>
              <div className="h-1.5 w-0 bg-[#B85C3C] group-hover:w-full transition-all duration-700" />
            </Card>

            {/* Key Highlights */}
            {eventData.keyHighlights && eventData.keyHighlights.length > 0 && (
              <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
                <CardHeader className="p-10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] flex items-center justify-center text-[#B85C3C]">
                      <Gift size={20} />
                    </div>
                    <CardTitle className="text-3xl font-bold text-[#2C1810] font-playfair">{t("events.public.details.highlightsHeader")}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-10 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {eventData.keyHighlights.map((highlight, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 rounded-2xl bg-[#FAF7F2]/50 border border-transparent hover:border-[#B85C3C]/20 transition-all group">
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-[#B85C3C] group-hover:scale-150 transition-all" />
                        <span className="text-muted-foreground font-medium">{highlight}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Special Privileges */}
            {eventData.specialPrivileges && eventData.specialPrivileges.length > 0 && (
              <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-[#2C1810] text-white relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Gift size={120} />
                </div>
                <CardHeader className="p-10 pb-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#D4AF37]">
                      <Sparkles size={20} />
                    </div>
                    <CardTitle className="text-3xl font-bold font-playfair">{t("events.public.details.privilegesHeader")}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-10 pt-4 relative z-10">
                  <div className="grid grid-cols-1 gap-4">
                    {eventData.specialPrivileges.map((privilege, index) => (
                      <div key={index} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                        <CheckCircle2 className="h-5 w-5 text-[#D4AF37] flex-shrink-0" />
                        <span className="text-white/80 font-light">{privilege}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Booking Sidebar */}
          <div className="space-y-6">
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
                  {/* Fee */}
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
                            <span>{t("events.registration.basePrice")}: {formatAmount(eventData.basePrice || (registrationAmount / (1 + (eventData.gstRate || 0) / 100)))}</span>
                            <span>{t("events.registration.gst")} ({eventData.gstRate || 0}%): {formatAmount(eventData.gstAmount || (registrationAmount - (registrationAmount / (1 + (eventData.gstRate || 0) / 100))))}</span>
                          </div>
                        </div>
                      )}
                      {isFree && (eventData.capacity && eventData.capacity > 0) && (
                        <p className="text-[10px] text-[#B85C3C] mt-2 font-bold uppercase tracking-tighter">
                          {t("events.public.details.limitedSlots")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Capacity Status */}
                  {hasCapacity && (
                    <div className={`p-4 rounded-2xl border flex gap-3 items-center ${isEventFull ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                      <Users className={`h-5 w-5 flex-shrink-0 ${isEventFull ? 'text-red-500' : 'text-emerald-600'}`} />
                      <div>
                        <p className={`text-xs font-bold ${isEventFull ? 'text-red-700' : 'text-emerald-700'}`}>
                          {isEventFull
                            ? t("events.public.details.eventFull", { defaultValue: "Event Full" })
                            : t(`events.public.details.slotsRemaining_${(slotsRemaining ?? 0) === 1 ? "one" : "other"}`, { count: slotsRemaining ?? 0, defaultValue: `${slotsRemaining ?? 0} slots remaining` })}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {currentRegistrations} / {eventData.capacity} {t("events.public.details.registered", { defaultValue: "registered" })}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Info Grid */}
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 sm:gap-4 rounded-2xl border border-[#F1E8DE] bg-[#FCFAF7] p-4 sm:p-5 group">
                      <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white flex shrink-0 items-center justify-center text-[#B85C3C] shadow-sm group-hover:bg-[#B85C3C] group-hover:text-white transition-all">
                        <Calendar size={20} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{scheduleLabel}</p>
                        <p className="text-base font-bold text-[#2C1810] leading-snug break-words">
                          {scheduleSummary}
                        </p>
                        {scheduleDetail.filter(Boolean).map((line) => (
                          <p key={line} className="text-sm font-medium text-muted-foreground leading-relaxed break-words">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 sm:gap-4 rounded-2xl border border-[#F1E8DE] bg-[#FCFAF7] p-4 sm:p-5 group">
                      <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white flex shrink-0 items-center justify-center text-[#B85C3C] shadow-sm group-hover:bg-[#B85C3C] group-hover:text-white transition-all">
                        <MapPin size={20} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("admin.events.management.table.location")}</p>
                        <p className="text-base font-bold text-[#2C1810] leading-snug break-words">
                          {eventData.location?.address}
                        </p>
                      </div>
                    </div>

                    {eventData.registrationDeadline && (
                      <div className="flex items-start gap-3 sm:gap-4 rounded-2xl border border-orange-100 bg-orange-50/50 p-4 sm:p-5 group">
                        <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-white flex shrink-0 items-center justify-center text-orange-600 shadow-sm group-hover:bg-orange-600 group-hover:text-white transition-all">
                          <Clock size={20} />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("events.public.details.deadline")}</p>
                          <p className="text-base font-bold text-[#2C1810] leading-snug break-words">
                            {formatDateTime(eventData.registrationDeadline)}
                          </p>
                          <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                            {t("events.public.details.registrationCloses", { defaultValue: "Registrations close at this time." })}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100/50 flex gap-3 items-start">
                      <Shield className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-blue-900 text-[10px] font-bold uppercase tracking-wider">{t("events.public.details.policy")}</p>
                        <p className="text-blue-700 text-[10px] leading-relaxed font-medium">
                          {isFree
                            ? t("events.public.details.policyFree")
                            : t("events.public.details.policyPaid")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Register Button */}
                  {showRegistration && (eventData.status === "upcoming" || eventData.status === "ongoing") && (
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
                        <><Users size={20} className="mr-2" />{t("events.public.details.eventFull", { defaultValue: "Event Full" })}</>
                      ) : (
                        <><Sparkles size={20} className="mr-2" />{t("events.public.details.registerNow")}</>
                      )}
                    </Button>
                  )}

                  {eventData.status === 'cancelled' && (
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

                  {eventData.status === "completed" && (
                    <div className="p-6 rounded-3xl bg-muted/30 border border-muted/50 text-center">
                      <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <h4 className="text-muted-foreground font-bold">{t("events.public.details.eventCompleted")}</h4>
                      <p className="text-muted-foreground/70 text-xs mt-2 font-medium">{t("events.public.details.concludedDesc")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Secure Booking Tip */}
              <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground/60">
                <Shield size={14} className="text-green-500/50" />
                <span className="text-[10px] uppercase font-bold tracking-widest">{t("events.public.details.secureRegistration")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetail;
