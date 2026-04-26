import { Shield } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { useTranslation } from "react-i18next";
import { ProfileMessages } from "@/shared/constants/messages/ProfileMessages";
import { BackButton } from "@/shared/components/ui/BackButton";
import { useNavigate } from "react-router-dom";

export const AdminProtectedView = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#FAF7F2]/30 py-12">
            <div className="container mx-auto px-4 max-w-2xl">
                <BackButton className="mb-8" />
                <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-amber-50 p-8 text-center">
                        <div className="mx-auto w-20 h-20 rounded-3xl bg-amber-100 flex items-center justify-center mb-4">
                            <Shield className="h-10 w-10 text-amber-600" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-[#2C1810]">{t(ProfileMessages.ADMIN_PROTECTED_TITLE)}</CardTitle>
                        <CardDescription className="text-amber-700 text-lg">{t(ProfileMessages.ADMIN_PROTECTED_SUB)}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6 text-center">
                        <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200">
                            <p className="text-[#2C1810] leading-relaxed">{t(ProfileMessages.ADMIN_PROTECTED_DESC)}</p>
                        </div>
                        <p className="text-muted-foreground">{t(ProfileMessages.ADMIN_PROTECTED_CONTACT)}</p>
                        <Button className="w-full h-14 rounded-xl bg-[#2C1810] hover:bg-[#B85C3C]" onClick={() => navigate("/profile")}>
                            {t(ProfileMessages.RETURN_TO_PROFILE)}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
