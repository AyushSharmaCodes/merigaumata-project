import { Clock, Calendar, Loader2, XCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { useTranslation } from "react-i18next";
import { ProfileMessages } from "@/shared/constants/messages/ProfileMessages";
import { BackButton } from "@/shared/components/ui/BackButton";

interface PendingDeletionViewProps {
    scheduledFor: string;
    isPending: boolean;
    onCancel: () => void;
}

export const PendingDeletionView = ({ scheduledFor, isPending, onCancel }: PendingDeletionViewProps) => {
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-[#FAF7F2]/30 py-12">
            <div className="container mx-auto px-4 max-w-2xl">
                <BackButton className="mb-8" />
                <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-amber-50 p-8">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
                                <Clock className="h-8 w-8 text-amber-600" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-bold text-[#2C1810]">{t(ProfileMessages.DELETION_SCHEDULED_STATUS)}</CardTitle>
                                <CardDescription className="text-amber-700">{t(ProfileMessages.DELETION_SCHEDULED_STATUS)}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="p-6 bg-amber-50 rounded-2xl">
                            <p className="text-sm text-amber-800">
                                <Calendar className="inline h-4 w-4 mr-2" />
                                {t(ProfileMessages.SCHEDULED_FOR, { date: new Date(scheduledFor).toLocaleDateString() })}
                            </p>
                        </div>
                        <p className="text-muted-foreground">{t(ProfileMessages.DELETION_CANCEL_HELP)}</p>
                        <Button variant="outline" className="w-full h-14 rounded-xl border-2" onClick={onCancel} disabled={isPending}>
                            {isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <XCircle className="h-5 w-5 mr-2" />}
                            {t(ProfileMessages.CANCEL_SCHEDULED_DELETION)}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
