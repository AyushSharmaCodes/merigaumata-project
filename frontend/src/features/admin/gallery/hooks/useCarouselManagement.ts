import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { galleryFolderService } from "@/domains/content";
import { toast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { useTranslation } from "react-i18next";

export const useCarouselManagement = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const location = useLocation();
    const basePath = location.pathname.startsWith("/manager") ? "/manager" : "/admin";

    const { data: folders = [], isLoading } = useQuery({
        queryKey: ["gallery-folders"],
        queryFn: galleryFolderService.getAll,
    });

    const currentCarouselFolder = folders.find((f) => f.is_home_carousel);
    const currentMobileCarouselFolder = folders.find((f) => f.is_mobile_carousel);

    const setCarouselMutation = useMutation({
        meta: { blocking: true },
        mutationFn: galleryFolderService.setHomeCarouselFolder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
            queryClient.invalidateQueries({ queryKey: ["carousel-slides"] });
            toast({ title: t("admin.carousel.toasts.updateCarouselSuccess") });
        },
        onError: (error) => toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" }),
    });

    const setMobileCarouselMutation = useMutation({
        meta: { blocking: true },
        mutationFn: galleryFolderService.setMobileCarouselFolder,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
            queryClient.invalidateQueries({ queryKey: ["carousel-slides"] });
            toast({ title: t("common.toasts.mobileCarouselUpdated") });
        },
        onError: (error) => toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" }),
    });

    const toggleHiddenMutation = useMutation({
        meta: { blocking: true },
        mutationFn: ({ id, is_hidden }: { id: string; is_hidden: boolean }) => galleryFolderService.update(id, { is_hidden }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
            queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
            toast({ title: t("admin.carousel.toasts.updateFolderSuccess") });
        },
        onError: (error) => toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" }),
    });

    return {
        t,
        basePath,
        folders,
        isLoading,
        currentCarouselFolder,
        currentMobileCarouselFolder,
        setCarouselMutation,
        setMobileCarouselMutation,
        toggleHiddenMutation,
    };
};
