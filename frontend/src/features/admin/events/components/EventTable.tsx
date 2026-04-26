import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { MapPin, Edit, CalendarDays, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { getLocalizedContent } from "@/core/utils/localizationUtils";
import { stripHtml } from "@/core/utils/stringUtils";
import { EventJobStatusBadge } from "./EventJobStatusBadge";
import type { Event } from "@/shared/types";

interface EventTableProps {
  events: Event[];
  onEdit: (event: Event) => void;
  onReschedule: (event: Event) => void;
  onCancel: (event: Event) => void;
  onRetryJob: (id: string) => void;
  isRetryingJob: boolean;
  currentLocale: any;
}

export const EventTable = ({
  events,
  onEdit,
  onReschedule,
  onCancel,
  onRetryJob,
  isRetryingJob,
  currentLocale,
}: EventTableProps) => {
  const { t, i18n } = useTranslation();

  const getStatusBadgeVariant = (status: Event["status"]): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      upcoming: "default", ongoing: "default", completed: "secondary", cancelled: "destructive",
    };
    return variants[status];
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.events.management.table.event")}</TableHead>
            <TableHead>{t("admin.events.management.table.date")}</TableHead>
            <TableHead>{t("admin.events.management.table.location")}</TableHead>
            <TableHead>{t("admin.events.management.table.status")}</TableHead>
            <TableHead className="text-right">{t("admin.events.management.table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <img src={event.image || '/placeholder-image.jpg'} alt={event.title} className="w-12 h-12 rounded object-cover" />
                  <div>
                    <p className="font-medium">{getLocalizedContent(event, i18n.language, 'title')}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1 max-w-xs">{stripHtml(getLocalizedContent(event, i18n.language, 'description'))}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <p className="font-medium">{event.startDate ? format(new Date(event.startDate), "MMM dd, yyyy", { locale: currentLocale }) : "N/A"}</p>
                  {event.endDate && event.endDate !== event.startDate && (
                    <p className="text-muted-foreground text-xs">{t("common.in")} {format(new Date(event.endDate), "MMM dd, yyyy", { locale: currentLocale })}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="line-clamp-1 max-w-[150px]">{(typeof event.location === 'string' ? event.location : event.location?.address) || t("common.noLocation")}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge variant={getStatusBadgeVariant(event.status)}>{t(`admin.events.status.${event.status}`)}</Badge>
                  {event.status === 'cancelled' && <EventJobStatusBadge eventId={event.id} onRetry={onRetryJob} isRetrying={isRetryingJob} />}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(event)} title={t("admin.events.management.tooltips.edit")}><Edit className="h-4 w-4" /></Button>
                  <Button
                    variant="ghost" size="icon" onClick={() => onReschedule(event)}
                    disabled={event.status === 'cancelled' || event.status === 'completed'}
                    title={t("admin.events.management.tooltips.reschedule")}
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                  {event.status === 'upcoming' && (
                    <Button variant="ghost" size="icon" className="text-orange-500 hover:text-orange-600" onClick={() => onCancel(event)} title={t("admin.events.management.tooltips.cancel")}><XCircle className="h-4 w-4" /></Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
