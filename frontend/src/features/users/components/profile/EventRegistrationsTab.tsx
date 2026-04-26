import { format } from "date-fns";
import { hi } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Loader2, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { ProfileMessages } from "@/shared/constants/messages/ProfileMessages";
import { CommonMessages } from "@/shared/constants/messages/CommonMessages";
import type { EventRegistration } from "@/domains/content";

interface EventRegistrationsTabProps {
  isLoading: boolean;
  registrations: EventRegistration[];
  totalRegistrations: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onNavigateToEvent: (id: string) => void;
  onCancelRegistration: (id: string) => void;
  formatAmount: (amount: number) => string;
}

export const EventRegistrationsTab = ({
  isLoading,
  registrations,
  totalRegistrations,
  page,
  limit,
  onPageChange,
  onNavigateToEvent,
  onCancelRegistration,
  formatAmount,
}: EventRegistrationsTabProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Card className="shadow-soft border border-border rounded-[2.5rem] overflow-hidden bg-card text-card-foreground">
        <CardHeader className="bg-muted/30 pb-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl shadow-sm">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-playfair">{t(ProfileMessages.EVENT_REGISTRATIONS)}</CardTitle>
              <CardDescription className="text-muted-foreground">{t(ProfileMessages.EVENT_REGISTRATIONS_DESC)}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#B85C3C]" />
            </div>
          ) : registrations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {registrations.map((reg) => {
                const eventStartDate = reg.events?.start_date ? new Date(reg.events.start_date) : null;
                if (eventStartDate && reg.events?.start_time) {
                  const [h, m] = reg.events.start_time.split(':').map(Number);
                  if (!isNaN(h) && !isNaN(m)) eventStartDate.setHours(h, m, 0, 0);
                }
                const now = Date.now();
                const twentyFourHoursMs = 24 * 60 * 60 * 1000;
                const canCancel = reg.status === 'confirmed' && eventStartDate && (eventStartDate.getTime() - now > twentyFourHoursMs);
                const isWithin24h = reg.status === 'confirmed' && eventStartDate && (eventStartDate.getTime() - now <= twentyFourHoursMs) && (eventStartDate.getTime() > now);

                const refundData = reg.event_refunds && reg.event_refunds.length > 0 ? reg.event_refunds[0] : (reg.refunds && reg.refunds.length > 0 ? reg.refunds[0] : null);

                return (
                  <div
                    key={reg.id}
                    className="group flex flex-col sm:flex-row gap-4 p-5 border border-border rounded-3xl hover:bg-muted/30 hover:border-primary/30 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md"
                    onClick={() => onNavigateToEvent(reg.event_id)}
                  >
                    <div className="w-full sm:w-28 h-28 bg-muted rounded-2xl overflow-hidden flex-shrink-0 shadow-inner">
                      {reg.events?.image ? (
                        <img
                          src={reg.events.image}
                          alt={reg.events.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted/50">
                          <Calendar className="h-10 w-10 text-muted-foreground/20" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                            {reg.events?.title || t(ProfileMessages.SACRED_GATHERING)}
                          </h3>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            {reg.events?.start_date
                              ? format(new Date(reg.events.start_date), 'PPP', { locale: t(CommonMessages.LANG) === 'hi' ? hi : undefined })
                              : t(ProfileMessages.DATE_TBD)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {reg.status === 'cancelled' ? (
                          <Badge variant="destructive" className="text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                            {t(ProfileMessages.CANCELLED)}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border-none shadow-sm ${reg.payment_status === 'paid' ? 'bg-green-500/10 text-green-400' :
                              reg.payment_status === 'free' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'
                              }`}
                          >
                            {reg.payment_status === 'paid'
                              ? `${formatAmount(reg.amount)} ${t(ProfileMessages.PAID)}`
                              : reg.payment_status === 'free'
                                ? t(ProfileMessages.COMPLIMENTARY)
                                : t(ProfileMessages.PENDING)}
                          </Badge>
                        )}

                        {reg.status === 'cancelled' && refundData && (
                          <Badge variant="outline" className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm ${refundData.status === 'SETTLED' ? 'bg-green-500/10 text-green-400' :
                            refundData.status === 'FAILED' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                            }`}>
                            {t(ProfileMessages.REFUND)}: {t(`profile.status.${refundData.status.toLowerCase()}`, refundData.status)}
                          </Badge>
                        )}

                        <Badge variant="secondary" className="text-[10px] font-mono bg-muted text-muted-foreground border-none">
                          {t(ProfileMessages.REGISTRATION_NUMBER)}{reg.registration_number}
                        </Badge>
                      </div>

                      {reg.status === 'confirmed' && (
                        <div className={`flex items-center gap-1.5 text-[10px] font-medium mt-1 ${isWithin24h ? 'text-orange-400' : 'text-muted-foreground'}`}>
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          {isWithin24h
                            ? t(ProfileMessages.CANCELLATION_WINDOW_PASSED)
                            : t(ProfileMessages.CANCELLATION_WINDOW_NOTE)}
                        </div>
                      )}

                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-0 text-[11px] font-bold uppercase tracking-wider text-primary hover:bg-transparent hover:text-primary-hover"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToEvent(reg.event_id);
                          }}
                        >
                          {t(ProfileMessages.DETAILS)}
                        </Button>

                        {canCancel && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-0 text-[11px] font-bold uppercase tracking-wider text-red-400 hover:bg-transparent hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancelRegistration(reg.id);
                            }}
                          >
                            {t(ProfileMessages.CANCEL_REGISTRATION)}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/20 rounded-[2rem] border-2 border-dashed border-border">
              <div className="bg-primary/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Calendar className="h-8 w-8 text-primary/30" />
              </div>
              <h3 className="text-foreground font-bold text-lg">{t(ProfileMessages.NO_REGISTRATIONS)}</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-1 mb-6">
                {t(ProfileMessages.NO_REGISTRATIONS_DESC)}
              </p>
              <Button
                onClick={() => onNavigateToEvent('')} // Should probably navigate to /events
                className="rounded-full px-8 bg-primary text-primary-foreground hover:bg-primary-hover transition-all font-bold"
              >
                {t(ProfileMessages.EXPLORE_EVENTS)}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {totalRegistrations > limit && (
        <div className="flex items-center justify-between mt-6 px-2">
          <div className="text-sm text-white/40">
            {t(ProfileMessages.SHOWING)} {(page - 1) * limit + 1} {t(ProfileMessages.TO)} {Math.min(page * limit, totalRegistrations)} {t(ProfileMessages.OF)} {totalRegistrations} {t(ProfileMessages.EVENTS)}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="rounded-full bg-card border-border text-foreground hover:bg-muted"
            >
              {t(ProfileMessages.PREVIOUS)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page * limit >= totalRegistrations}
              className="rounded-full bg-card border-border text-foreground hover:bg-muted"
            >
              {t(ProfileMessages.NEXT)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
