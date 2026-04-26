import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

export function DynamicTitle() {
    const { t, i18n } = useTranslation();
    const location = useLocation();

    useEffect(() => {
        // Route to title key mapping
        const routeTitleMap: Record<string, string> = {
            "/": "nav.home",
            "/shop": "nav.shop",
            "/about": "nav.about",
            "/contact": "nav.contact",
            "/faq": "nav.faq",
            "/gallery": "nav.gallery",
            "/events": "nav.events",
            "/donate": "nav.donate",
            "/my-orders": "nav.myOrders",
            "/profile": "nav.profile",
            "/cart": "nav.cart",
            "/checkout": "nav.checkout"
        };

        const currentRouteKey = routeTitleMap[location.pathname];
        const pageTitle = currentRouteKey ? t(currentRouteKey) : "";
        const baseTitle = t("meta.title");
        
        // Update document title: "Page | Base Title" or just "Base Title"
        document.title = pageTitle ? `${pageTitle} | ${baseTitle}` : baseTitle;
        const description = t("meta.description");
        const keywords = t("meta.keywords");

        // Handled above with route map
        // document.title = baseTitle;

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

    }, [location.pathname, i18n.language, t]);

    return null;
}
