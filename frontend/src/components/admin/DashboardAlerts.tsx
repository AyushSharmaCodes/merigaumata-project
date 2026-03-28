import React, { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAlertService, AdminAlert } from '@/services/admin-alert.service';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDateLocale } from '@/utils/dateLocale';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, X, MessageSquare, AlertCircle, Info, ExternalLink, User, Mail, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export const DashboardAlerts = () => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const basePath = location.pathname.startsWith('/manager') ? '/manager' : '/admin';
    const seenUnreadAlertsRef = useRef<Set<string>>(new Set());
    const { data: alerts = [], isLoading } = useQuery({
        queryKey: ['admin-alerts-unread'],
        queryFn: adminAlertService.getUnreadAlerts,
        refetchInterval: 10000,
    });

    useEffect(() => {
        const seenUnreadAlerts = seenUnreadAlertsRef.current;
        const nextSeenUnreadAlerts = new Set<string>(seenUnreadAlerts);

        alerts.forEach((alert) => {
            const wasSeen = seenUnreadAlerts.has(alert.id);
            nextSeenUnreadAlerts.add(alert.id);

            if (!wasSeen && alert.status === 'unread') {
                toast.info(t('admin.dashboard.alerts.newAlert', { title: alert.title }), {
                    description: alert.content,
                    icon: <Bell className="h-4 w-4" />
                });
            }
        });

        seenUnreadAlertsRef.current = nextSeenUnreadAlerts;
    }, [alerts, t]);

    const handleDismiss = async (id: string) => {
        try {
            await adminAlertService.markAsRead(id);
            queryClient.setQueryData(['admin-alerts-unread'], (old: AdminAlert[] | undefined) =>
                old ? old.filter(a => a.id !== id) : []
            );
        } catch (error) {
        }
    };

    const handleAction = (alert: AdminAlert) => {
        if (alert.type === 'contact_message') {
            navigate(`${basePath}/contact-messages/${alert.reference_id}`);
            return;
        }

        if (alert.type === 'event_cancellation_job') {
            const eventId = alert.metadata?.eventId as string | undefined;
            const query = eventId ? `?type=EVENT_CANCELLATION&jobId=${alert.reference_id}&eventId=${eventId}` : `?type=EVENT_CANCELLATION&jobId=${alert.reference_id}`;
            navigate(`${basePath}/jobs${query}`);
        }
    };

    const getAlertIcon = (type: string, priority: string) => {
        if (priority === 'high') return <AlertCircle className="h-5 w-5 text-destructive" />;

        switch (type) {
            case 'contact_message':
                return <MessageSquare className="h-5 w-5 text-[#B85C3C]" />;
            case 'event_cancellation_job':
                return <CalendarClock className="h-5 w-5 text-amber-600" />;
            default:
                return <Info className="h-5 w-5 text-muted-foreground" />;
        }
    };

    if (isLoading || alerts.length === 0) return null;

    return (
        <div className="mb-8 px-1">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Bell className="h-5 w-5 text-[#B85C3C] animate-pulse" />
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B85C3C] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#B85C3C]"></span>
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-[#2C1810] font-playfair tracking-tight">
                        {t('admin.dashboard.alerts.title', { count: alerts.length })}
                    </h3>
                </div>
                {alerts.length > 1 && (
                    <p className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border">
                        {t('admin.dashboard.alerts.swipe')}
                    </p>
                )}
            </div>

            <Carousel className="w-full" opts={{ loop: true }}>
                <CarouselContent>
                    {alerts.map((alert) => (
                        <CarouselItem key={alert.id}>
                            <Card className={`overflow-hidden border-none shadow-md bg-white group hover:shadow-lg transition-all duration-300`}>
                                <div className={`h-1.5 w-full ${alert.priority === 'high' ? 'bg-destructive' :
                                    alert.priority === 'medium' ? 'bg-[#B85C3C]' : 'bg-muted'
                                    }`} />
                                <CardContent className="p-5 flex items-start gap-5">
                                    <div className="mt-1 p-2 rounded-xl bg-[#FDFBF7] text-[#B85C3C] group-hover:scale-110 transition-transform">
                                        {getAlertIcon(alert.type, alert.priority)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-4 mb-1">
                                            <p className="font-bold text-base text-[#2C1810] truncate uppercase tracking-wider">{alert.title}</p>
                                            <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap bg-muted/40 px-2 py-0.5 rounded-full border border-border/50">
                                                {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: getDateLocale() })}
                                            </span>
                                        </div>

                                        {alert.type === 'contact_message' && alert.metadata && (
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <User className="h-3 w-3" />
                                                    <span>{alert.metadata.name as string}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <Mail className="h-3 w-3" />
                                                    <span>{alert.metadata.email as string}</span>
                                                </div>
                                            </div>
                                        )}

                                        {alert.type === 'event_cancellation_job' && alert.metadata && (
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <CalendarClock className="h-3 w-3" />
                                                    <span>{(alert.metadata.eventTitle as string) || t('admin.dashboard.alerts.unknownEvent')}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <AlertCircle className="h-3 w-3" />
                                                    <span>{(alert.metadata.status as string) || t('admin.dashboard.alerts.attentionRequired')}</span>
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 italic border-l-2 border-[#B85C3C]/20 pl-3 py-1 bg-[#FDFBF7]/50 rounded-r-lg">
                                            "{alert.content}"
                                        </p>

                                        <div className="mt-4 flex items-center gap-3">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 px-4 border-[#B85C3C] text-[#B85C3C] hover:bg-[#B85C3C] hover:text-white transition-all rounded-full"
                                                onClick={() => handleAction(alert)}
                                            >
                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                {alert.type === 'event_cancellation_job' ? t('admin.dashboard.alerts.viewJob') : t('admin.dashboard.alerts.viewMessage')}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 px-4 text-muted-foreground hover:bg-muted rounded-full"
                                                onClick={() => handleDismiss(alert.id)}
                                            >
                                                <X className="mr-2 h-4 w-4" />
                                                {t('admin.dashboard.alerts.dismiss')}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                {alerts.length > 1 && (
                    <>
                        <CarouselPrevious className="-left-4 lg:-left-6 h-10 w-10 border-none shadow-xl bg-white hover:bg-[#B85C3C] hover:text-white transition-colors" />
                        <CarouselNext className="-right-4 lg:-right-6 h-10 w-10 border-none shadow-xl bg-white hover:bg-[#B85C3C] hover:text-white transition-colors" />
                    </>
                )}
            </Carousel>
        </div>
    );
};
