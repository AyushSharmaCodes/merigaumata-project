import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage, getErrorDetails } from "@/core/utils/errorUtils";
import { validators } from "@/core/utils/validation";
import { settingsApi } from "@/domains/settings";
import { faqService } from "@/domains/content";

export function useContactPage() {
    const { t, i18n } = useTranslation();
    const { toast } = useToast();
    const location = useLocation();
    
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: faqs = [], isLoading: isLoadingFAQs, isError: faqError } = useQuery({
        queryKey: ["contact-faqs", i18n.language],
        queryFn: async () => {
            return await faqService.getAll(false);
        },
        staleTime: 10 * 60 * 1000,
    });

    const { data: siteContent, isLoading: isLoadingSiteContent } = useQuery({
        queryKey: ["public-site-content", i18n.language],
        queryFn: () => settingsApi.publicContent.getSiteContent(false),
        staleTime: 10 * 60 * 1000,
    });

    const socialMediaLinks = siteContent?.socialMedia || [];
    const contactInfo = siteContent?.contactInfo;

    useEffect(() => {
        if (!isLoadingFAQs && !isLoadingSiteContent && location.hash) {
            const element = document.getElementById(location.hash.replace('#', ''));
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        }
    }, [isLoadingFAQs, isLoadingSiteContent, location.hash]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: Record<string, string> = {};
        const nameError = validators.required(formData.name);
        const emailRequiredError = validators.required(formData.email);
        const emailFormatError = !emailRequiredError ? validators.email(formData.email.trim()) : null;
        const phoneRequiredError = validators.required(formData.phone);
        const phoneFormatError = !phoneRequiredError ? validators.phone(formData.phone.trim()) : null;
        const subjectError = validators.required(formData.subject);
        const messageError = validators.required(formData.message);
        const messageMinLengthError = !messageError ? validators.minLength(formData.message, 10) : null;

        if (nameError) newErrors.name = t("validation.requiredField", { field: t("contact.name") });
        if (emailRequiredError) {
            newErrors.email = t("validation.requiredField", { field: t("contact.email") });
        } else if (emailFormatError) {
            newErrors.email = t(emailFormatError);
        }
        if (phoneRequiredError) {
            newErrors.phone = t("validation.requiredField", { field: t("contact.phone") });
        } else if (phoneFormatError) {
            newErrors.phone = t(phoneFormatError);
        }
        if (subjectError) newErrors.subject = t("validation.requiredField", { field: t("contact.subject") });

        if (messageError) {
            newErrors.message = t("validation.requiredField", { field: t("contact.message") });
        } else if (messageMinLengthError) {
            newErrors.message = t(messageMinLengthError);
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsSubmitting(true);

        try {
            await settingsApi.contact.sendMessage({
                name: formData.name.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim(),
                subject: formData.subject.trim(),
                message: formData.message.trim()
            });

            toast({
                title: t("common.success"),
                description: t("success.contact.messageReceived"),
            });
            setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
        } catch (error: unknown) {
            const details = getErrorDetails(error);
            if (details) {
                const backendErrors: Record<string, string> = {};
                details.forEach((d) => {
                    const field = d.path?.[d.path.length - 1] || 'general';
                    backendErrors[field] = d.message.startsWith("errors.") || d.message.startsWith("validation.")
                        ? t(d.message)
                        : d.message;
                });
                setErrors(backendErrors);
            } else {
                toast({
                    title: t("common.error"),
                    description: getErrorMessage(error, t, "errors.system.generic_error"),
                    variant: "destructive",
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        t,
        i18n,
        formData,
        setFormData,
        errors,
        setErrors,
        isSubmitting,
        faqs,
        isLoadingFAQs,
        faqError,
        siteContent,
        isLoadingSiteContent,
        socialMediaLinks,
        contactInfo,
        handleSubmit
    };
}
