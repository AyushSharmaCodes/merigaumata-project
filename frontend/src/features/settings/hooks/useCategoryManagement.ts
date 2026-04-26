import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { settingsApi } from "@/domains/settings";
import { Category, CategoryType } from "@/domains/settings/model/settings.types";

export function useCategoryManagement(type?: CategoryType) {
    const { t, i18n } = useTranslation();
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [categoryName, setCategoryName] = useState("");
    const queryClient = useQueryClient();

    const { data: categories = [], isLoading } = useQuery({
        queryKey: ["admin-categories", type, searchQuery, i18n.language],
        queryFn: async () => {
            const allCategories = await settingsApi.categories.getAll(type);
            if (!searchQuery) return allCategories;
            return allCategories.filter((c) =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        },
    });

    const categoryMutation = useMutation({
        mutationFn: async ({ id, name }: { id?: string; name: string }) => {
            if (id) {
                return settingsApi.categories.update(id, { name });
            } else {
                return settingsApi.categories.create({ name, type: type || "product" });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
            queryClient.invalidateQueries({ queryKey: ["categories"] });
            queryClient.invalidateQueries({ queryKey: ["admin-products"] });
            toast({
                title: t("common.success"),
                description: selectedCategory
                    ? t("admin.categories.dialog.updateSuccess")
                    : t("admin.categories.dialog.createSuccess"),
            });
            setCategoryDialogOpen(false);
            setSelectedCategory(null);
            setCategoryName("");
        },
        onError: (error: unknown) => {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.categories.dialog.saveError"),
                variant: "destructive",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await settingsApi.categories.delete(id);
            return id;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
            queryClient.invalidateQueries({ queryKey: ["categories"] });
            queryClient.invalidateQueries({ queryKey: ["admin-products"] });
            toast({
                title: t("common.success"),
                description: t("admin.categories.dialog.deleteSuccess"),
            });
            setDeleteDialogOpen(false);
            setSelectedCategory(null);
        },
        onError: (error: unknown) => {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.categories.dialog.deleteError"),
                variant: "destructive",
            });
        },
    });

    const handleAddCategory = () => {
        setSelectedCategory(null);
        setCategoryName("");
        setCategoryDialogOpen(true);
    };

    const handleEditCategory = (category: Category) => {
        setSelectedCategory(category);
        setCategoryName(category.original_name || category.name);
        setCategoryDialogOpen(true);
    };

    const handleDeleteCategory = (category: Category) => {
        setSelectedCategory(category);
        setDeleteDialogOpen(true);
    };

    const handleSaveCategory = () => {
        if (!categoryName.trim()) {
            toast({
                title: t("common.error"),
                description: t("admin.categories.dialog.nameRequired"),
                variant: "destructive",
            });
            return;
        }

        categoryMutation.mutate({
            id: selectedCategory?.id,
            name: categoryName,
        });
    };

    const handleConfirmDelete = () => {
        if (selectedCategory) {
            deleteMutation.mutate(selectedCategory.id);
        }
    };

    return {
        t,
        i18n,
        searchQuery,
        setSearchQuery,
        categoryDialogOpen,
        setCategoryDialogOpen,
        deleteDialogOpen,
        setDeleteDialogOpen,
        selectedCategory,
        categoryName,
        setCategoryName,
        categories,
        isLoading,
        handleAddCategory,
        handleEditCategory,
        handleDeleteCategory,
        handleSaveCategory,
        handleConfirmDelete
    };
}
