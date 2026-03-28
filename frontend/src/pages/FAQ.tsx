import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Search,
  MessageCircle,
  Phone,
  ChevronRight,
  HelpCircle,
  Mail,
  ArrowRight
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { faqService, type FAQWithCategory } from "@/services/faq.service";
import { publicContentService } from "@/services/public-content.service";
import { getLocalizedContent } from "@/utils/localizationUtils";

export default function FAQ() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: faqs = [], isLoading: isLoadingFaqs } = useQuery({
    queryKey: ["public-faqs", i18n.language],
    queryFn: () => faqService.getAll(false),
  });

  const { data: siteContent, isLoading: isLoadingSiteContent } = useQuery({
    queryKey: ["public-site-content", i18n.language],
    queryFn: () => publicContentService.getSiteContent(false),
  });

  const contactInfo = siteContent?.contactInfo;

  const isLoading = isLoadingFaqs || isLoadingSiteContent;

  // Group FAQs by category
  const faqsByCategory = faqs.reduce((acc, faq) => {
    const categoryName = getLocalizedContent(faq.category, i18n.language) || faq.category?.name || t("faq.generalCategory", "General");
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(faq);
    return acc;
  }, {} as Record<string, FAQWithCategory[]>);

  const categories = Object.keys(faqsByCategory).sort();

  // Filter FAQs based on search and category
  const filteredFaqs = faqs.filter(faq => {
    const question = getLocalizedContent(faq, i18n.language, 'question');
    const answer = getLocalizedContent(faq, i18n.language, 'answer');
    
    const matchesSearch =
      question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesCategory = !activeCategory || getLocalizedContent(faq.category, i18n.language) === activeCategory || faq.category?.name === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return <LoadingOverlay isLoading={true} message={t("faq.loading")} />;
  }

  const primaryPhone = contactInfo?.phones.find(p => p.is_primary) || contactInfo?.phones[0];

  return (
    <div className="min-h-screen bg-background pb-20 overflow-hidden">
      {/* Hero Section */}
      <section className="relative h-[45vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="/faq-hero.png"
            alt={t("faq.heroAlt")}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-background" />
        </div>

        <div className="container relative z-10 mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#B85C3C]/20 text-[#B85C3C] mb-6 border border-[#B85C3C]/30 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <HelpCircle className="h-4 w-4" />
            <span className="text-sm font-bold uppercase tracking-widest">{t("faq.title")}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 font-playfair animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
            {t("faq.heroTitle")}
          </h1>

          <div className="max-w-2xl mx-auto relative group animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-white/50 group-focus-within:text-[#B85C3C] transition-colors" />
            <Input
              id="faq-search"
              name="faq-search"
              aria-label={t("faq.searchPlaceholder")}
              type="text"
              placeholder={t("faq.searchPlaceholder")}
              className="w-full h-16 pl-14 pr-6 rounded-2xl bg-white/10 backdrop-blur-md border-white/20 text-white placeholder:text-white/40 focus:bg-white focus:text-[#2C1810] focus:placeholder:text-[#2C1810]/30 shadow-2xl transition-all text-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl -mt-10 relative z-20">
        {/* Category Filter */}
        <div className="flex gap-3 overflow-x-auto pb-4 mb-12 no-scrollbar justify-center">
          <Button
            variant={activeCategory === null ? "default" : "outline"}
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-8 h-12 font-bold shadow-md transition-all ${activeCategory === null
              ? "bg-[#B85C3C] hover:bg-[#A04B2E] text-white"
              : "bg-white hover:bg-muted"
              }`}
          >
            {t("faq.allQuestions")}
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={activeCategory === category ? "default" : "outline"}
              onClick={() => setActiveCategory(category)}
              className={`rounded-full px-8 h-12 font-bold shadow-md transition-all ${activeCategory === category
                ? "bg-[#B85C3C] hover:bg-[#A04B2E] text-white"
                : "bg-white hover:bg-muted font-bold"
                }`}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-4xl mx-auto space-y-12">
          {searchQuery || activeCategory ? (
            <div className="space-y-6">
              {filteredFaqs.length > 0 ? (
                <Accordion type="single" collapsible className="w-full space-y-4">
                  {filteredFaqs.map((faq) => (
                    <AccordionItem
                      key={faq.id}
                      value={faq.id}
                      className="border-none bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden px-8"
                    >
                      <AccordionTrigger className="text-left py-6 hover:no-underline font-bold text-lg md:text-xl text-[#2C1810] hover:text-[#B85C3C] transition-colors group">
                        <span className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-lg bg-[#B85C3C]/10 flex items-center justify-center text-[#B85C3C] text-sm group-hover:bg-[#B85C3C] group-hover:text-white transition-all">Q</span>
                          {getLocalizedContent(faq, i18n.language, 'question')}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground text-lg leading-relaxed pb-8 pl-12 border-t border-dashed border-border/50 pt-6">
                        {getLocalizedContent(faq, i18n.language, 'answer')}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <Card className="border-none shadow-xl bg-white p-16 text-center">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6 text-muted-foreground">
                    <Search className="h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-bold text-[#2C1810] mb-2">{t("faq.noMatches")}</h3>
                  <p className="text-muted-foreground">{t("faq.noMatchesDesc", { query: searchQuery })}</p>
                  <Button
                    variant="link"
                    className="mt-4 text-[#B85C3C] font-bold"
                    onClick={() => { setSearchQuery(""); setActiveCategory(null); }}
                  >
                    {t("faq.clearFilters")}
                  </Button>
                </Card>
              )}
            </div>
          ) : (
            categories.map((category) => (
              <div key={category} className="space-y-6">
                <div className="flex items-center gap-4 px-2">
                  <div className="h-1.5 w-12 bg-[#B85C3C] rounded-full" />
                  <h2 className="text-3xl font-bold text-[#2C1810] font-playfair">{category}</h2>
                </div>
                <Accordion type="single" collapsible className="w-full space-y-4">
                  {faqsByCategory[category].map((faq) => (
                    <AccordionItem
                      key={faq.id}
                      value={faq.id}
                      className="border-none bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden px-8"
                    >
                      <AccordionTrigger className="text-left py-6 hover:no-underline font-bold text-lg md:text-xl text-[#2C1810] hover:text-[#B85C3C] transition-colors group">
                        <span className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-lg bg-[#B85C3C]/10 flex items-center justify-center text-[#B85C3C] text-sm group-hover:bg-[#B85C3C] group-hover:text-white transition-all">Q</span>
                          {getLocalizedContent(faq, i18n.language, 'question')}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground text-lg leading-relaxed pb-8 pl-12 border-t border-dashed border-border/50 pt-6">
                        {getLocalizedContent(faq, i18n.language, 'answer')}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Still Have Questions? */}
      <section className="mt-32">
        <Card className="border-none shadow-2xl bg-[#2C1810] text-white overflow-hidden rounded-[3rem]">
          <CardContent className="p-0 flex flex-col md:flex-row items-center">
            <div className="p-10 md:p-16 flex-1 space-y-8">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold font-playfair">{t("faq.stillHaveQuestions")}</h2>
                <p className="text-white/70 text-lg leading-relaxed">
                  {t("faq.contactSupport")}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-6">
                {primaryPhone && (
                  <a
                    href={`tel:${primaryPhone.number}`}
                    className="flex items-center gap-4 group"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-white group-hover:bg-[#B85C3C] transition-all duration-300 transform group-hover:-translate-y-1">
                      <Phone className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white/50 uppercase tracking-widest">{t("faq.callUs")}</p>
                      <p className="text-xl font-bold group-hover:text-[#B85C3C] transition-colors">{primaryPhone.number}</p>
                    </div>
                  </a>
                )}

                <Link
                  to="/contact#contact-form"
                  className="flex items-center gap-4 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#B85C3C] flex items-center justify-center text-white shadow-lg shadow-[#B85C3C]/20 transition-all duration-300 transform group-hover:-translate-y-1 group-hover:bg-[#A04B2E]">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white/50 uppercase tracking-widest">{t("faq.contactUs")}</p>
                    <p className="text-xl font-bold group-hover:text-[#B85C3C] transition-colors flex items-center gap-2">
                      {t("faq.messageUs")} <ArrowRight className="h-5 w-5 animate-in slide-in-from-left-2 duration-700" />
                    </p>
                  </div>
                </Link>
              </div>
            </div>

            <div className="hidden md:block w-1/3 h-full relative self-stretch">
              <img
                src="/contact-hero.png"
                alt={t("faq.contactAlt")}
                className="absolute inset-0 w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#2C1810]" />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
