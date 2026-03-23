import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

export function DynamicTitle() {
    const { t, i18n } = useTranslation();
    const location = useLocation();

    useEffect(() => {
        // Basic mapping of routes to translation keys for titles if needed
        // However, the request specifically asked for the title to update based on language.
        // We'll use the 'meta.title' from the locale file as the base.

        const baseTitle = t("meta.title");
        const description = t("meta.description");
        const keywords = t("meta.keywords");

        // Update document title
        document.title = baseTitle;

        // Update meta description
        let metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.setAttribute("content", description);
        } else {
            metaDescription = document.createElement('meta');
            metaDescription.setAttribute('name', 'description');
            metaDescription.setAttribute('content', description);
            document.head.appendChild(metaDescription);
        }

        // Update meta keywords
        let metaKeywords = document.querySelector('meta[name="keywords"]');
        if (metaKeywords) {
            metaKeywords.setAttribute("content", keywords);
        } else {
            metaKeywords = document.createElement('meta');
            metaKeywords.setAttribute('name', 'keywords');
            metaKeywords.setAttribute('content', keywords);
            document.head.appendChild(metaKeywords);
        }

        // Update lang attribute on html tag
        document.documentElement.lang = i18n.language;

    }, [i18n.language, t]);

    return null;
}
