import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { staticApi } from "@/domains/content";
import { publicContentService } from "@/domains/settings";

export function useAboutPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  const { data: aboutContent, isLoading } = useQuery({
    queryKey: ["aboutUs", i18n.language],
    queryFn: () => staticApi.about.getAll(),
  });

  const { data: siteContent } = useQuery({
    queryKey: ["public-site-content", i18n.language],
    queryFn: () => publicContentService.getSiteContent(false),
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (location.hash && !isLoading && aboutContent) {
      const id = location.hash.replace("#", "");
      const timer = setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [location.hash, isLoading, aboutContent]);

  const visibility = aboutContent?.sectionVisibility || {
    missionVision: true,
    impactStats: true,
    ourStory: true,
    team: true,
    futureGoals: true,
    callToAction: true,
  };

  return {
    t,
    i18n,
    aboutContent,
    siteContent,
    isLoading,
    visibility,
  };
}
