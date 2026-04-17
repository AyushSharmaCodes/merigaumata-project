import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Mail, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { hi } from "date-fns/locale";

interface OrderEmailLogsSectionProps {
    emailLogs: any[];
}

export const OrderEmailLogsSection = memo(({ emailLogs }: OrderEmailLogsSectionProps) => {
    const { t, i18n } = useTranslation();

    if (!emailLogs || emailLogs.length === 0) return null;

    return (
        <Card className="mt-6 border-dashed bg-slate-50/30">
            <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                    <Mail className="h-4 w-4" />
                    {t("admin.orders.detail.emailHistory.title")}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="space-y-3">
                    {emailLogs.map((log: any, idx: number) => (
                        <div key={idx} className="flex items-start justify-between text-xs p-2 rounded bg-white border border-slate-100 shadow-sm">
                            <div className="space-y-1">
                                <div className="font-medium text-slate-700 flex items-center gap-2">
                                    {log.subject}
                                    {log.status === 'delivered' ? (
                                        <CheckCircle2 size={12} className="text-green-500" />
                                    ) : (
                                        <XCircle size={12} className="text-red-500" />
                                    )}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    {t("admin.orders.detail.emailHistory.sentTo")}: {log.recipient_email}
                                </div>
                                {log.error_message && (
                                    <div className="text-[9px] text-red-500 bg-red-50 px-1 py-0.5 rounded border border-red-100 flex items-center gap-1 mt-1">
                                        <XCircle size={8} /> {log.error_message}
                                    </div>
                                )}
                            </div>
                            <time className="text-[10px] text-muted-foreground bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                {format(new Date(log.sent_at), "MMM d, HH:mm", { locale: i18n.language === 'hi' ? hi : undefined })}
                            </time>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
});

OrderEmailLogsSection.displayName = "OrderEmailLogsSection";
