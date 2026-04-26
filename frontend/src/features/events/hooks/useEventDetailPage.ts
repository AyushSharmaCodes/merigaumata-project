import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { hi, enUS } from "date-fns/locale";
import { eventsApi } from "@/domains/content";
import { useCurrency } from "@/app/providers/currency-provider";

export function useEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { formatAmount } = useCurrency();
  const currentLocale = i18n.language === "hi" ? hi : enUS;

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId, i18n.language],
    queryFn: () => eventsApi.getById(eventId || ""),
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

  return {
    eventId,
    event,
    isLoading,
    t,
    i18n,
    formatAmount,
    handleRegister,
    formatTime,
    isSameCalendarDay,
    formatFullDate,
    formatDateTime,
  };
}
