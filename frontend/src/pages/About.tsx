import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { aboutService } from "@/services/about.service";
import { publicContentService } from "@/services/public-content.service";
import { getLocalizedContent } from "@/utils/localizationUtils";
import {
  Heart,
  Target,
  Eye,
  Users,
  TrendingUp,
  Award,
  Calendar,
  CheckCircle2,
  Flag,
  Star,
  Shield,
  Zap,
  LucideIcon,
  ArrowRight,
  Sparkles
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TestimonialForm } from "@/components/TestimonialForm";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  Heart,
  Target,
  Eye,
  Users,
  TrendingUp,
  Award,
  Flag,
  Star,
  Shield,
  Zap,
  CheckCircle2,
};

export default function About() {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  const { data: aboutContent, isLoading } = useQuery({
    queryKey: ["aboutUs", i18n.language],
    queryFn: () => aboutService.getAll(),
  });

  const { data: siteContent } = useQuery({
    queryKey: ["public-site-content", i18n.language],
    queryFn: () => publicContentService.getSiteContent(false),
    staleTime: 10 * 60 * 1000,
  });

  // Scroll to hash anchor (e.g. #feedback) after content loads
  useEffect(() => {
    if (location.hash && !isLoading && aboutContent) {
      const id = location.hash.replace("#", "");
      // Small delay to ensure DOM has rendered
      const timer = setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [location.hash, isLoading, aboutContent]);

  if (isLoading || !aboutContent) {
    return <LoadingOverlay isLoading={true} />;
  }

  const visibility = aboutContent.sectionVisibility || {
    missionVision: true,
    impactStats: true,
    ourStory: true,
    team: true,
    futureGoals: true,
    callToAction: true,
  };

  return (
    <div className="min-h-screen bg-background pb-20 overflow-hidden">
      {/* Compact Premium Hero Section */}
      <section className="bg-[#2C1810] text-white py-16 md:py-24 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Sparkles className="h-48 w-48 text-[#B85C3C]" />
        </div>
        <div className="container relative z-10 mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B85C3C]/10 text-[#B85C3C] border border-[#B85C3C]/20 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Sparkles className="h-3 w-3" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{t("about.title")}</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold text-white font-playfair animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                {t("about.journeyTitlePart1")} <span className="text-[#B85C3C]">{t("about.journeyTitlePart2")}</span>
              </h1>
            </div>
            <p className="text-white/60 text-base md:text-lg max-w-md font-light leading-relaxed border-l border-[#B85C3C]/30 pl-8 hidden md:block animate-in fade-in slide-in-from-right-8 duration-1000 delay-300">
              {t("about.dedicatedSubtitle")}
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-20">
        {/* Mission & Vision Row */}
        {visibility.missionVision && (
          <section className="mb-24 -mt-16">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {aboutContent.cards
                .sort((a, b) => a.order - b.order)
                .map((card) => {
                  const IconComponent = iconMap[card.icon] || Target;
                  return (
                    <Card
                      key={card.id}
                      className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 bg-white/80 backdrop-blur-md overflow-hidden group"
                    >
                      <CardHeader className="p-10 pb-4">
                        <div className="w-16 h-16 rounded-2xl bg-[#B85C3C]/10 flex items-center justify-center mb-6 text-[#B85C3C] group-hover:bg-[#B85C3C] group-hover:text-white transition-all duration-300">
                          <IconComponent className="h-8 w-8" />
                        </div>
                        <CardTitle className="text-3xl font-bold text-[#2C1810] mb-2">
                          {getLocalizedContent(card, i18n.language, 'title')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-10 pt-0">
                        <p className="text-muted-foreground text-lg leading-relaxed">
                          {getLocalizedContent(card, i18n.language, 'description')}
                        </p>
                      </CardContent>
                      <div className="h-2 w-0 bg-[#B85C3C] group-hover:w-full transition-all duration-500" />
                    </Card>
                  );
                })}
            </div>
          </section>
        )}

        {/* Story Section */}
        {visibility.ourStory && (
          <section className="mb-32">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
              <div className="lg:w-1/2 space-y-8">
                <div className="space-y-4">
                  <h2 className="text-4xl md:text-5xl font-bold text-[#2C1810] font-playfair">{t("about.ourStory")}</h2>
                  <div className="h-1.5 w-24 bg-[#B85C3C] rounded-full" />
                </div>
                <p className="text-xl text-muted-foreground leading-relaxed italic font-light border-l-4 border-[#B85C3C] pl-6">
                  {t("about.storySubtitle")}
                </p>
                <div className="relative pl-8 border-l border-dashed border-[#B85C3C]/30 space-y-12">
                  {aboutContent.timeline
                    .sort((a, b) => a.order - b.order)
                    .map((item) => (
                      <div key={item.id} className="relative group">
                        <div className="absolute -left-10 top-1 w-4 h-4 rounded-full bg-[#B85C3C] border-4 border-white shadow-md group-hover:scale-125 transition-all" />
                        <div className="space-y-2">
                          <span className="inline-block px-3 py-1 rounded-md bg-[#B85C3C]/10 text-[#B85C3C] text-sm font-bold">
                            {getLocalizedContent(item, i18n.language, 'month')} {item.year}
                          </span>
                          <h3 className="text-xl font-bold text-[#2C1810]">
                            {getLocalizedContent(item, i18n.language, 'title')}
                          </h3>
                          <p className="text-muted-foreground text-lg">
                            {getLocalizedContent(item, i18n.language, 'description')}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <div className="lg:w-1/2 relative">
                <div className="relative rounded-[3rem] overflow-hidden shadow-2xl z-10 transform scale-95 group-hover:scale-100 transition-all duration-700">
                  <img
                    src={siteContent?.brandAssets?.['ABOUT_HERO']}
                    alt={t("about.storyVisualAlt")}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-[#B85C3C]/10 mix-blend-multiply" />
                </div>
                <div className="absolute -top-10 -right-10 w-64 h-64 bg-[#B85C3C]/10 rounded-full blur-3xl -z-10" />
                <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-[#2C1810]/5 rounded-full blur-3xl -z-10" />
              </div>
            </div>
          </section>
        )}

        {/* Impact Statistics */}
        {visibility.impactStats && (
          <section className="mb-32 py-20 bg-[#2C1810] rounded-[4rem] text-white px-8 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-12 opacity-5">
              <Heart className="h-96 w-96 text-[#B85C3C]" />
            </div>

            <div className="container mx-auto relative z-10">
              <div className="text-center mb-20 space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold font-playfair">{t("about.ourImpact")}</h2>
                <p className="text-white/60 text-xl max-w-2xl mx-auto">{t("about.impactSubtitle")}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 max-w-6xl mx-auto">
                {aboutContent.impactStats
                  .sort((a, b) => a.order - b.order)
                  .map((stat) => {
                    const IconComponent = iconMap[stat.icon] || TrendingUp;
                    return (
                      <div key={stat.id} className="text-center group">
                        <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-[#B85C3C] group-hover:scale-110 transition-all duration-300 transform -rotate-6 group-hover:rotate-0">
                          <IconComponent className="h-10 w-10 text-white" />
                        </div>
                        <div className="text-5xl font-bold mb-2 font-mono text-[#B85C3C]">{stat.value}</div>
                        <p className="text-white/70 text-lg uppercase tracking-widest font-bold">
                          {getLocalizedContent(stat, i18n.language, 'label')}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>
        )}

        {/* Team Section */}
        {visibility.team && (
          <section className="mb-32">
            <div className="text-center mb-20 space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold text-[#2C1810] font-playfair">{t("about.meetTeam")}</h2>
              <p className="text-muted-foreground text-xl max-w-2xl mx-auto">{t("about.teamSubtitle")}</p>
              <div className="h-1.5 w-24 bg-[#B85C3C] rounded-full mx-auto mt-6" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
              {aboutContent.teamMembers
                .sort((a, b) => a.order - b.order)
                .map((member) => (
                  <Card
                    key={member.id}
                    className="group border-none shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden rounded-3xl bg-white"
                  >
                    <div className="aspect-[4/5] overflow-hidden relative">
                      <img
                        src={member.image}
                        alt={member.name}
                        loading="lazy"
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#2C1810]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-end p-8">
                        <p className="text-white text-sm font-medium leading-relaxed">
                          {getLocalizedContent(member, i18n.language, 'bio')}
                        </p>
                      </div>
                    </div>
                    <CardHeader className="text-center p-8 bg-white relative z-10 transition-transform duration-500 group-hover:-translate-y-2">
                      <CardTitle className="text-2xl font-bold text-[#2C1810] mb-1">
                        {getLocalizedContent(member, i18n.language, 'name')}
                      </CardTitle>
                      <CardDescription className="text-[#B85C3C] font-bold text-sm uppercase tracking-widest">
                        {getLocalizedContent(member, i18n.language, 'role')}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
            </div>
          </section>
        )}

        {/* Future Goals */}
        {visibility.futureGoals && (
          <section className="mb-32 py-24 bg-muted/30 rounded-[4rem] px-8 md:px-16 overflow-hidden relative">
            <div className="absolute bottom-0 left-0 p-12 opacity-5 -scale-x-100">
              <Target className="h-64 w-64 text-[#B85C3C]" />
            </div>

            <div className="max-w-4xl mx-auto relative z-10">
              <div className="text-center mb-16 space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold text-[#2C1810] font-playfair">{t("about.futureGoals")}</h2>
                <p className="text-muted-foreground text-xl italic">{t("about.goalsSubtitle")}</p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {aboutContent.futureGoals
                  .sort((a, b) => a.order - b.order)
                  .map((goal) => (
                    <Card key={goal.id} className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden group">
                      <CardContent className="p-8">
                        <div className="flex items-start gap-6">
                          <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#B85C3C]/10 flex items-center justify-center group-hover:bg-[#B85C3C] group-hover:text-white transition-all duration-300">
                            <CheckCircle2 className="h-7 w-7 text-[#B85C3C] group-hover:text-white" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="font-bold text-2xl text-[#2C1810]">
                              {getLocalizedContent(goal, i18n.language, 'title')}
                            </h3>
                            <p className="text-muted-foreground text-lg leading-relaxed">
                              {getLocalizedContent(goal, i18n.language, 'description')}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          </section>
        )}

        {/* Call to Action */}
        {visibility.callToAction && (
          <section className="mb-32">
            <Card className="border-none shadow-2xl bg-gradient-to-br from-[#B85C3C] to-[#A04B2E] text-white overflow-hidden rounded-[3rem] p-12 md:p-20 text-center relative">
              <div className="absolute top-0 left-0 p-8 opacity-20">
                <Users className="h-32 w-32" />
              </div>
              <div className="relative z-10 space-y-8 max-w-3xl mx-auto">
                <h2 className="text-4xl md:text-6xl font-bold font-playfair">{t("about.joinUs")}</h2>
                <p className="text-white/80 text-xl md:text-2xl leading-relaxed font-light">
                  {t("about.joinUsSubtitle")}
                </p>
                <div className="flex flex-col sm:flex-row gap-6 justify-center pt-4">
                  <Button asChild size="lg" className="bg-white text-[#B85C3C] hover:bg-white/90 rounded-full px-12 py-8 text-xl font-bold shadow-2xl h-auto">
                    <a href="/donate" className="flex items-center gap-3">
                      {t("about.donateNow")} <ArrowRight className="h-6 w-6" />
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="border-white text-white hover:bg-white/10 rounded-full px-12 py-8 text-xl font-bold h-auto bg-transparent">
                    <a href="/events">{t("about.volunteer")}</a>
                  </Button>
                </div>
              </div>
            </Card>
          </section>
        )}

        {/* Testimonial Form Section */}
        <section id="feedback" className="py-20 bg-white rounded-[4rem] shadow-sm border border-border/50">
          <div className="container mx-auto px-4 md:px-12">
            <div className="text-center mb-16 space-y-4">
              <div className="w-16 h-1 bg-[#B85C3C] rounded-full mx-auto" />
              <h2 className="text-4xl md:text-5xl font-bold text-[#2C1810] font-playfair">
                {t("about.whatDoYouThink")}
              </h2>
              <p className="text-muted-foreground text-xl max-w-2xl mx-auto pt-2">
                {t("about.feedbackSubtitle")}
              </p>
            </div>
            <div className="max-w-4xl mx-auto">
              <TestimonialForm />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
