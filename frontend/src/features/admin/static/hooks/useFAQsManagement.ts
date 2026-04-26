import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { faqService, type FAQWithCategory } from "@/domains/content";
import { settingsApi } from "@/domains/settings";
import { toast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { downloadCSV, flattenObject } from "@/core/utils/exportUtils";
import { logger } from "@/core/observability/logger";

const ITEMS_PER_PAGE = 10;

export const useFAQsManagement = () => {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [faqDialogOpen, setFaqDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedFaq, setSelectedFaq] = useState<FAQWithCategory | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const { data: faqs = [], isLoading } = useQuery({
        queryKey: ["admin-faqs", i18n.language],
        queryFn: () => faqService.getAll(true),
    });

    const { data: categories = [] } = useQuery({
        queryKey: ["faq-categories", i18n.language],
        queryFn: () => settingsApi.categories.getAll('faq'),
    });

    const filteredFaqs = faqs.filter((faq) => {
        const matchesCategory = categoryFilter === "all" || faq.category_id === categoryFilter;
        const matchesSearch = !searchQuery ||
            faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const totalPages = Math.ceil(filteredFaqs.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedFaqs = filteredFaqs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const faqMutation = useMutation({
        meta: { blocking: true },
        mutationFn: (faq: any) => faq.id ? faqService.update(faq.id, faq) : faqService.create(faq),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
            toast({ title: t("common.success"), description: selectedFaq ? "FAQ updated successfully" : "FAQ created successfully" });
            setFaqDialogOpen(false);
            setSelectedFaq(null);
        },
        onError: (error: unknown) => toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        meta: { blocking: true },
        mutationFn: (id: string) => faqService.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
            toast({ title: t("common.success"), description: t("admin.faqs.toasts.deleteSuccess") });
            setDeleteDialogOpen(false);
            setSelectedFaq(null);
        },
        onError: (error: unknown) => toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" }),
    });

    const toggleActiveMutation = useMutation({
        meta: { blocking: true },
        mutationFn: (id: string) => faqService.toggleActive(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
            toast({ title: t("common.success"), description: t("admin.faqs.messages.statusUpdated") });
        },
        onError: (error: unknown) => toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" }),
    });

    const handleExport = () => {
        const exportData = faqs.map((faq) => flattenObject(faq as unknown as Record<string, unknown>));
        downloadCSV(exportData, "faqs");
        toast({ title: t("common.success"), description: t("admin.faqs.messages.exported") });
    };

    return {
        t,
        searchQuery, setSearchQuery,
        categoryFilter, setCategoryFilter,
        faqDialogOpen, setFaqDialogOpen,
        deleteDialogOpen, setDeleteDialogOpen,
        selectedFaq, setSelectedFaq,
        currentPage, setCurrentPage,
        categories,
        filteredFaqs,
        paginatedFaqs,
        totalPages,
        startIndex,
        isLoading,
        faqMutation,
        deleteMutation,
        toggleActiveMutation,
        handleExport,
    };
};
