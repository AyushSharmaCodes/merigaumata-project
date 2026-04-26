import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { HandHeart, Stethoscope, Home, Leaf } from "lucide-react";

export const DonationImpact = () => {
    const { t } = useTranslation();

    const impacts = [
        {
            icon: <Leaf className="w-6 h-6 text-green-600" />,
            title: t("donate.impact1Title"),
            desc: t("donate.impact1Desc"),
            color: "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800"
        },
        {
            icon: <Stethoscope className="w-6 h-6 text-blue-600" />,
            title: t("donate.impact2Title"),
            desc: t("donate.impact2Desc"),
            color: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800"
        },
        {
            icon: <Home className="w-6 h-6 text-amber-600" />,
            title: t("donate.impact3Title"),
            desc: t("donate.impact3Desc"),
            color: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800"
        },
        {
            icon: <HandHeart className="w-6 h-6 text-red-600" />,
            title: t("donate.impact4Title"),
            desc: t("donate.impact4Desc"),
            color: "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800"
        }
    ];

    return (
        <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center space-y-3">
                <h2 className="text-3xl font-bold font-playfair">{t("donate.whyDonate")}</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    {t("donate.impactSubtitle")}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {impacts.map((item, index) => (
                    <Card key={index} className={`transition-all hover:shadow-md hover:-translate-y-1 ${item.color}`}>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-3 text-lg font-semibold">
                                <div className="p-2 bg-background rounded-full shadow-sm">
                                    {item.icon}
                                </div>
                                {item.title}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground/90 text-sm leading-relaxed">
                                {item.desc}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
    );
};
