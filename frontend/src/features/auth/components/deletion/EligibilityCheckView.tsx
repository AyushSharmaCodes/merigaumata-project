import { CheckCircle2, Loader2, Shield, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { useTranslation } from "react-i18next";
import { ProfileMessages } from "@/shared/constants/messages/ProfileMessages";
import { useNavigate } from "react-router-dom";
import { EligibilityResponse } from "../../hooks/useAccountDeletion";

interface EligibilityCheckViewProps {
    eligibility?: EligibilityResponse;
    isLoading: boolean;
    onRefresh: () => void;
    onRequestOtp: () => void;
    isOtpPending: boolean;
}

export const EligibilityCheckView = ({ eligibility, isLoading, onRefresh, onRequestOtp, isOtpPending }: EligibilityCheckViewProps) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="p-8 border-b">
                <CardTitle className="text-2xl font-bold text-[#2C1810]">{t(ProfileMessages.DELETE_ACCOUNT_TITLE)}</CardTitle>
                <CardDescription>{t(ProfileMessages.DELETE_ACCOUNT_DESC)}</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                ) : eligibility?.eligible ? (
                    <div className="space-y-6">
                        <div className="p-6 bg-green-50 rounded-2xl flex items-center gap-4">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                            <div>
                                <p className="font-bold text-green-900">{t(ProfileMessages.ACCOUNT_ELIGIBLE)}</p>
                                <p className="text-sm text-green-700">{t(ProfileMessages.PROCEED_DELETION)}</p>
                            </div>
                        </div>
                        <Button className="w-full h-14 rounded-xl bg-red-600 hover:bg-red-700" onClick={onRequestOtp} disabled={isOtpPending}>
                            {isOtpPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Shield className="h-5 w-5 mr-2" />}
                            {t(ProfileMessages.VERIFY_IDENTITY)}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="p-6 bg-amber-50 rounded-2xl">
                            <p className="font-bold text-amber-900 mb-2">{t(ProfileMessages.CANNOT_DELETE)}</p>
                            <p className="text-sm text-amber-700">{t(ProfileMessages.RESOLVE_ISSUES)}</p>
                        </div>
                        {eligibility?.blockingReasons.map((reason, index) => (
                            <div key={index} className="p-4 bg-white border rounded-xl flex items-start gap-4">
                                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="font-medium text-[#2C1810]">{reason.message}</p>
                                    {reason.action && (
                                        <Button variant="link" className="p-0 h-auto text-sm text-[#B85C3C]" onClick={() => navigate(reason.action!.url)}>
                                            {reason.action.label}<ExternalLink className="h-3 w-3 ml-1" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" className="w-full" onClick={onRefresh}>{t(ProfileMessages.REFRESH_STATUS)}</Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
