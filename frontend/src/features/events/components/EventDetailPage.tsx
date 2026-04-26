import { Calendar, Shield } from "lucide-react";
import { EventDetailSkeleton } from "@/shared/components/ui/page-skeletons";
import { useEventDetailPage } from "../hooks/useEventDetailPage";
import type { Event } from "@/shared/types";
import { BackButton } from "@/shared/components/ui/BackButton";

// Sub-components
import { EventHero } from "./detail/EventHero";
import { EventAbout } from "./detail/EventAbout";
import { EventHighlights } from "./detail/EventHighlights";
import { EventPrivileges } from "./detail/EventPrivileges";
import { EventSidebar } from "./detail/EventSidebar";

export function EventDetailPage() {
  const {
    event,
    isLoading,
    t,
    formatAmount,
    handleRegister,
    formatTime,
    isSameCalendarDay,
    formatFullDate,
    formatDateTime,
  } = useEventDetailPage();

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

  const scheduleType = event.scheduleType || "single_day";
  const hasSameStartAndEndDate = isSameCalendarDay(event.startDate, event.endDate || event.startDate);
  
  const scheduleLabel = scheduleType === "multi_day_daily"
    ? t("events.public.details.dailyScheduleLabel", { defaultValue: "Daily Event Schedule" })
    : scheduleType === "multi_day_continuous"
      ? t("events.public.details.continuousScheduleLabel", { defaultValue: "Continuous Event Schedule" })
      : t("events.public.details.schedule", { defaultValue: "Event Schedule" });

  const scheduleSummary = scheduleType === "multi_day_continuous"
    ? `${formatDateTime(event.startDate, event.startTime)} ${t("events.public.details.until", { defaultValue: "until" })} ${formatDateTime(event.endDate || event.startDate, event.endTime)}`
    : hasSameStartAndEndDate
      ? formatFullDate(event.startDate)
      : `${formatFullDate(event.startDate)} - ${formatFullDate(event.endDate || event.startDate)}`;

  const scheduleDetail = scheduleType === "multi_day_continuous"
    ? [
        t("events.public.details.continuousHighlight", { defaultValue: "This event runs continuously and does not close at the end of each day." }),
        `${t("events.public.details.starts", { defaultValue: "Starts" })}: ${formatDateTime(event.startDate, event.startTime)}`,
        event.endDate
          ? `${t("events.public.details.ends", { defaultValue: "Ends" })}: ${formatDateTime(event.endDate, event.endTime)}`
          : null
      ].filter(Boolean) as string[]
    : scheduleType === "multi_day_daily"
      ? [
          t("events.public.details.dailyHighlight", { defaultValue: "This event happens on each day in the date range during the timing below." }),
          event.startTime && event.endTime
            ? t("events.public.details.dailyWindow", {
                defaultValue: "Each day: {{start}} - {{end}}",
                start: formatTime(event.startTime),
                end: formatTime(event.endTime)
              })
            : null
        ].filter(Boolean) as string[]
      : [event.startTime && event.endTime
          ? `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`
          : event.startTime
            ? formatTime(event.startTime)
            : event.endTime
              ? formatTime(event.endTime)
              : null].filter(Boolean) as string[];

  const hasCapacity = event.capacity != null && event.capacity > 0;
  const currentRegistrations = event.registrations || 0;
  const isEventFull = hasCapacity && currentRegistrations >= event.capacity!;
  const slotsRemaining = hasCapacity ? Math.max(0, event.capacity! - currentRegistrations) : null;

  const getStatusVariant = (status: Event["status"]) => {
    switch (status) {
      case "upcoming": return "info";
      case "ongoing": return "success";
      case "completed": return "default";
      case "cancelled": return "destructive";
      default: return "default";
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]/30 pb-20">
      <EventHero event={event} getStatusVariant={getStatusVariant} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl -mt-16 md:-mt-20 relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="rounded-[2.5rem] overflow-hidden shadow-2xl bg-muted aspect-[16/9] relative group animate-in fade-in zoom-in-95 duration-1000">
              <img
                src={event.image || "/placeholder.svg"}
                alt={event.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
              />
              {!event.image && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                  <Calendar className="h-16 w-16 mb-4 opacity-20" />
                  <p>{t("events.registration.noImage")}</p>
                </div>
              )}
            </div>

            <EventAbout description={event.description} />
            <EventHighlights highlights={event.keyHighlights || []} />
            <EventPrivileges privileges={event.specialPrivileges || []} />
          </div>

          <div className="space-y-6">
            <EventSidebar
              event={event}
              formatAmount={formatAmount}
              formatDateTime={formatDateTime}
              formatTime={formatTime}
              handleRegister={handleRegister}
              isEventFull={isEventFull}
              slotsRemaining={slotsRemaining}
              scheduleLabel={scheduleLabel}
              scheduleSummary={scheduleSummary}
              scheduleDetail={scheduleDetail}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
