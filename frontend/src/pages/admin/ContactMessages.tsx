import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contactService } from '@/services/contact.service';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Clock, MessageSquare, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDateLocale } from '@/utils/dateLocale';

export default function ContactMessages() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/manager') ? '/manager' : '/admin';
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['admin-contact-messages', page, pageSize],
        queryFn: () => contactService.getMessages({ page, limit: pageSize }),
    });

    const messages = data?.messages || [];
    const pagination = data?.pagination;

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

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-playfair text-[#2C1810]">{t("admin.messages.title")}</h1>
                <p className="text-muted-foreground">{t("admin.messages.subtitle")}</p>
            </div>

            {pagination && pagination.total > 0 && (
                <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                    <p>{pagination.total} total</p>
                    {isFetching && !isLoading && (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Refreshing</span>
                        </div>
                    )}
                </div>
            )}

            <div className="grid gap-4">
                {messages.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                            <p className="text-lg font-medium text-muted-foreground">{t("admin.messages.empty")}</p>
                        </CardContent>
                    </Card>
                ) : (
                    messages.map((msg) => (
                        <Card key={msg.id} className="hover:shadow-md transition-shadow cursor-pointer border-none shadow-sm" onClick={() => navigate(`${basePath}/contact-messages/${msg.id}`)}>
                            <CardContent className="p-6">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-2 flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            {getStatusBadge(msg.status)}
                                            <h3 className="font-bold text-lg truncate text-[#2C1810]">{msg.name}</h3>
                                        </div>
                                        {msg.subject && (
                                            <p className="text-sm font-semibold text-[#2C1810] truncate">
                                                {msg.subject}
                                            </p>
                                        )}

                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1">
                                                <Mail className="h-4 w-4" />
                                                <span>{msg.email}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-4 w-4" />
                                                <span>{formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: getDateLocale() })}</span>
                                            </div>
                                        </div>

                                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2 italic italic border-l-2 border-[#B85C3C]/20 pl-3 py-1">
                                            "{msg.message}"
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 self-end md:self-center">
                                        <Button variant="outline" size="sm" className="rounded-full border-[#B85C3C] text-[#B85C3C] hover:bg-[#B85C3C] hover:text-white">
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            {t("admin.messages.viewDetail")}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between gap-4">
                    <Button
                        variant="outline"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page === 1 || isFetching}
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Previous
                    </Button>
                    <p className="text-sm text-muted-foreground">
                        Page {page} of {pagination.totalPages}
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                        disabled={page >= pagination.totalPages || isFetching}
                    >
                        Next
                        <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                </div>
            )}
        </div>
    );
}
