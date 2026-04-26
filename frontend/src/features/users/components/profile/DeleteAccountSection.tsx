import { logger } from "@/core/observability/logger";
import { Button } from "@/shared/components/ui/button";
import { useTranslation } from "react-i18next";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { ProfileMessages } from "@/shared/constants/messages/ProfileMessages";

interface DeleteAccountSectionProps {
    onDelete: () => Promise<void>;
}

export default function DeleteAccountSection({ onDelete }: DeleteAccountSectionProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        setLoading(true);
        try {
            await onDelete();
        } catch (error) {
            logger.error('Error deleting account:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="rounded-[2.5rem] border border-red-500/20 bg-card overflow-hidden shadow-soft">
            <CardHeader className="pb-4 pt-6 px-8">
                <CardTitle className="text-xl font-bold font-playfair text-red-400">{t(ProfileMessages.DELETE_ACCOUNT_TITLE)}</CardTitle>
                <CardDescription className="text-muted-foreground">
                    {t(ProfileMessages.DELETE_ACCOUNT_DESC)}
                </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-6 space-y-4">
                <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-red-400/80 font-bold text-xs uppercase tracking-wider">
                        <AlertTriangle className="h-4 w-4" />
                        <span>{t(ProfileMessages.WARNING)}</span>
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-1.5 font-medium">
                        <li className="flex items-center gap-2">
                            <div className="h-1 w-1 rounded-full bg-red-500/30"></div>
                            {t(ProfileMessages.DELETE_DATA_LOGIN)}
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="h-1 w-1 rounded-full bg-red-500/30"></div>
                            {t(ProfileMessages.DELETE_DATA_ADDRESSES)}
                        </li>
                        <li className="flex items-center gap-2">
                            <div className="h-1 w-1 rounded-full bg-red-500/30"></div>
                            {t(ProfileMessages.DELETE_DATA_CART)}
                        </li>
                    </ul>
                </div>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="rounded-full px-8 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-all font-bold text-[10px] uppercase tracking-widest h-11">
                            {t(ProfileMessages.BUTTON)}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-3xl border-border bg-card text-card-foreground shadow-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="font-playfair text-2xl">{t(ProfileMessages.CONFIRM_TITLE)}</AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-foreground">
                                {t(ProfileMessages.CONFIRM_DESC)}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-3">
                            <AlertDialogCancel className="rounded-full bg-muted border-border text-foreground hover:bg-muted/80">{t(ProfileMessages.CONFIRM_CANCEL)}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDelete}
                                disabled={loading}
                                className="rounded-full bg-red-500 hover:bg-red-600 text-white border-0"
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t(ProfileMessages.CONFIRM_DELETE)}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
