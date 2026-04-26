import { Milk } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavMessages } from "@/shared/constants/messages/NavMessages";
import { HomeMessages } from "@/shared/constants/messages/HomeMessages";

interface Benefit {
    icon: any;
    title: string;
    description: string;
}

interface BenefitsSectionProps {
    benefits: Benefit[];
}

export const BenefitsSection = ({ benefits }: BenefitsSectionProps) => {
    const { t } = useTranslation();

    return (
        <section className="py-12 bg-white relative overflow-hidden">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-10 space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/20">
                        <Milk className="h-3 w-3" /> {t(NavMessages.BRAND_SUBTITLE)}
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold font-playfair text-foreground">
                        {t(HomeMessages.BENEFITS_TITLE)}
                    </h2>
                    <p className="text-muted-foreground text-base md:text-lg font-medium max-w-2xl mx-auto">
                        {t(HomeMessages.BENEFITS_SUBTITLE)}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {benefits.map((benefit, index) => (
                        <div
                            key={index}
                            className="group p-8 rounded-[2rem] bg-muted/20 border border-transparent hover:border-primary/20 hover:bg-white hover:shadow-elevated transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 flex flex-col items-center text-center"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="w-16 h-16 rounded-2xl bg-white shadow-soft flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-background transition-all duration-500 text-primary">
                                <benefit.icon className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-3 font-playfair">{benefit.title}</h3>
                            <p className="text-sm text-muted-foreground/80 font-light leading-relaxed">{benefit.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
