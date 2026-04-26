import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { staticApi, FAQWithCategory } from "@/domains/content";
import { publicContentService } from "@/domains/settings";
import { getLocalizedContent } from "@/core/utils/localizationUtils";

export function useFAQPage() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: faqs = [], isLoading: isLoadingFaqs } = useQuery({
    queryKey: ["public-faqs", i18n.language],
    queryFn: () => staticApi.faqs.getAll(false),
  });

  const { data: siteContent, isLoading: isLoadingSiteContent } = useQuery({
    queryKey: ["public-site-content", i18n.language],
    queryFn: () => publicContentService.getSiteContent(false),
  });

  const contactInfo = siteContent?.contactInfo;
  const isLoading = isLoadingFaqs || isLoadingSiteContent;

  const faqsByCategory = faqs.reduce((acc, faq) => {
    const categoryName = getLocalizedContent(faq.category, i18n.language) || faq.category?.name || t("faq.generalCategory", "General");
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(faq);
    return acc;
  }, {} as Record<string, FAQWithCategory[]>);

  const categories = Object.keys(faqsByCategory).sort();

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

  const primaryPhone = contactInfo?.phones.find(p => p.is_primary) || contactInfo?.phones[0];

  return {
    t,
    i18n,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    faqsByCategory,
    categories,
    filteredFaqs,
    siteContent,
    isLoading,
    primaryPhone,
  };
}
