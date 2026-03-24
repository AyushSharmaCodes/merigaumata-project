import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { contactService } from '@/services/contact.service';
import { adminAlertService } from '@/services/admin-alert.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, User, Clock, ArrowLeft, MailSearch, ShieldCheck, Monitor, MapPin, X } from 'lucide-react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errorUtils';
import { useTranslation } from 'react-i18next';
import { getDateLocale } from '@/utils/dateLocale';

export default function ContactMessageDetail() {
    const { t } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const basePath = location.pathname.startsWith('/manager') ? '/manager' : '/admin';

    const { data: message, isLoading, error } = useQuery({
        queryKey: ['admin-contact-message', id],
        queryFn: () => contactService.getMessageById(id!),
        enabled: !!id,
    });

    const markReadMutation = useMutation({
        mutationFn: () => contactService.updateMessageStatus(id!, 'READ'),
        onSuccess: (updatedMessage) => {
            queryClient.setQueryData(['admin-contact-message', id], updatedMessage);
            queryClient.invalidateQueries({ queryKey: ['admin-alerts-unread'] });
            queryClient.invalidateQueries({ queryKey: ['admin-contact-messages'] });
        }
    });

    const dismissMutation = useMutation({
        mutationFn: () => adminAlertService.markAsReadByReferenceId('contact_message', id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-alerts-unread'] });
            toast.success(t("admin.messages.notificationDismissed"));
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, t, "admin.messages.dismissError"));
        }
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'NEW':
                return <Badge variant="destructive">{t("admin.messages.status.new")}</Badge>;
            case 'READ':
                return <Badge variant="secondary">{t("admin.messages.status.read")}</Badge>;
            case 'REPLIED':
                return <Badge variant="default" className="bg-green-500">{t("admin.messages.status.replied")}</Badge>;
            case 'ARCHIVED':
                return <Badge variant="outline">{t("admin.messages.status.archived")}</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const handleReply = () => {
        if (message) {
            const subject = encodeURIComponent(t("admin.messages.reply.subject"));
            const body = encodeURIComponent(t("admin.messages.reply.body", { name: message.name, message: message.message }));
            window.location.href = `mailto:${message.email}?subject=${subject}&body=${body}`;
        }
    };

    useEffect(() => {
        if (id && message?.status === 'NEW' && !markReadMutation.isPending && !markReadMutation.isSuccess) {
            markReadMutation.mutate();
        }
    }, [id, message?.status, markReadMutation]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !message) {
        return (
            <div className="text-center p-12">
                <p className="text-destructive mb-4">{t("admin.messages.loadError")}</p>
                <Button onClick={() => navigate(`${basePath}/contact-messages`)}>{t("admin.messages.backToMessages")}</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold font-playfair text-[#2C1810]">{t("admin.messages.detailTitle")}</h1>
                    <p className="text-muted-foreground">{t("admin.messages.submittedOn", { date: format(new Date(message.created_at), 'PPPpppp', { locale: getDateLocale() }) })}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-sm">
                        <CardHeader className="border-b bg-[#FDFBF7]/30">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <MailSearch className="h-5 w-5 text-[#B85C3C]" />
                                    {t("admin.messages.contentTitle")}
                                </CardTitle>
                                {getStatusBadge(message.status)}
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="prose prose-stone max-w-none">
                                <p className="text-[#2C1810] leading-relaxed whitespace-pre-wrap text-lg italic border-l-4 border-[#B85C3C]/40 pl-6 py-2 bg-[#FDFBF7]/50 rounded-r-xl">
                                    {message.message}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button
                            className="flex-1 bg-[#B85C3C] hover:bg-[#A04F32] rounded-full h-12 text-white font-bold"
                            onClick={handleReply}
                        >
                            <Mail className="h-4 w-4 mr-2" />
                            {t("admin.messages.replyViaEmail")}
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1 rounded-full border-[#B85C3C] text-[#B85C3C] h-12 font-bold hover:bg-[#B85C3C]/10"
                            onClick={() => dismissMutation.mutate()}
                            disabled={dismissMutation.isPending}
                        >
                            <X className="h-4 w-4 mr-2" />
                            {t("admin.messages.dismissAlert")}
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    <Card className="border-none shadow-sm">
                        <CardHeader className="border-b bg-[#FDFBF7]/30">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <User className="h-5 w-5 text-[#B85C3C]" />
                                {t("admin.messages.senderInfo")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("admin.messages.name")}</label>
                                <p className="font-bold text-[#2C1810] text-lg">{message.name}</p>
                            </div>
                            <div className="pt-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("admin.messages.email")}</label>
                                <div className="flex items-center gap-2 text-[#B85C3C] font-medium underline underline-offset-4">
                                    <Mail className="h-4 w-4" />
                                    <a href={`mailto:${message.email}`}>{message.email}</a>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm">
                        <CardHeader className="border-b bg-[#FDFBF7]/30">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-[#B85C3C]" />
                                {t("admin.messages.technicalMetadata")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4 text-sm">
                            <div className="flex items-center gap-3">
                                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("admin.messages.ipAddress")}</label>
                                    <p className="font-mono text-muted-foreground">{message.ip_address || t("admin.messages.notCaptured")}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Monitor className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{t("admin.messages.userAgent")}</label>
                                    <p className="text-muted-foreground leading-snug break-all">{message.user_agent || t("admin.messages.notCaptured")}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
