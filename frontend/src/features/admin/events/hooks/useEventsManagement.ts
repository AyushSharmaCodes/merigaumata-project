import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { eventService } from "@/domains/content";
import { uploadService } from "@/core/upload/upload-client";
import { toast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { logger } from "@/core/observability/logger";
import { getEventUploadFolder } from "@/core/upload/upload-utils";
import type { Event } from "@/shared/types";
import { hi, enUS, ta, te } from "date-fns/locale";

export const useEventsManagement = () => {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();

    const getLocale = (lang: string) => {
        switch (lang) {
            case 'hi': return hi;
            case 'ta': return ta;
            case 'te': return te;
            default: return enUS;
        }
    };

    const currentLocale = getLocale(i18n.language);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [eventDialogOpen, setEventDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ["admin-events", searchQuery, page, i18n.language],
        queryFn: () => eventService.getAll({ page, limit: 15, search: searchQuery }),
    });

    const eventMutation = useMutation({
        meta: { blocking: true },
        mutationFn: async (eventData: Partial<Event> & { imageFile?: File; replacedImageUrl?: string }) => {
            const finalEvent = { ...eventData };
            let uploadedImageUrl: string | null = null;

            if (eventData.imageFile) {
                setIsUploading(true);
                try {
                    const response = await uploadService.uploadImage(
                        eventData.imageFile,
                        'event',
                        getEventUploadFolder({
                            title: finalEvent.title || selectedEvent?.title,
                            title_i18n: finalEvent.title_i18n || selectedEvent?.title_i18n
                        })
                    );
                    finalEvent.image = response.url;
                    uploadedImageUrl = response.url;
                    delete finalEvent.imageFile;
                } finally {
                    setIsUploading(false);
                }
            }

            try {
                if (finalEvent.id) {
                    return await eventService.update(finalEvent.id, finalEvent);
                } else {
                    return await eventService.create(finalEvent as Omit<Event, "id">);
                }
            } catch (error) {
                if (uploadedImageUrl) {
                    try {
                        await uploadService.deleteImageByUrl(uploadedImageUrl);
                    } catch (cleanupError) {
                        logger.error("Failed to cleanup orphaned event image", { cleanupError });
                    }
                }
                throw error;
            }
        },
        onSuccess: async (_data, variables) => {
            if (variables.replacedImageUrl) {
                try {
                    await uploadService.deleteImageByUrl(variables.replacedImageUrl);
                } catch (cleanupError) {
                    logger.error("Failed to cleanup replaced event image", { cleanupError });
                }
            }
            queryClient.invalidateQueries({ queryKey: ["admin-events"] });
            toast({
                title: t("common.success"),
                description: selectedEvent ? t("admin.events.toasts.updated") : t("admin.events.toasts.created"),
            });
            setEventDialogOpen(false);
            setSelectedEvent(null);
        },
        onError: (error: unknown) => {
            toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" });
        },
    });

    const cancelMutation = useMutation({
        meta: { blocking: true },
        mutationFn: ({ id, reason }: { id: string; reason: string }) => eventService.cancel(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-events"] });
            toast({ title: t("admin.events.toasts.cancelInitiated") });
            setCancelDialogOpen(false);
            setSelectedEvent(null);
        },
        onError: (error: unknown) => {
            toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" });
        },
    });

    const rescheduleMutation = useMutation({
        meta: { blocking: true },
        mutationFn: ({ id, data }: { id: string; data: { startDate: string; endDate?: string; reason: string } }) => eventService.updateSchedule(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-events"] });
            toast({ title: t("admin.events.toasts.rescheduled") });
            setRescheduleDialogOpen(false);
            setSelectedEvent(null);
        },
        onError: (error: unknown) => {
            toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" });
        },
    });

    const retryMutation = useMutation({
        meta: { blocking: true },
        mutationFn: (eventId: string) => eventService.retryCancellation(eventId),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["admin-events"] });
            queryClient.invalidateQueries({ queryKey: ["job-status"] });
            toast({ title: t("admin.events.toasts.retryInitiated", { message: data.message }) });
        },
        onError: (error: unknown) => {
            toast({ title: t("admin.events.toasts.retryFailed"), description: getErrorMessage(error), variant: "destructive" });
        },
    });

    return {
        t,
        i18n,
        currentLocale,
        searchQuery, setSearchQuery,
        page, setPage,
        data,
        isLoading,
        eventDialogOpen, setEventDialogOpen,
        cancelDialogOpen, setCancelDialogOpen,
        rescheduleDialogOpen, setRescheduleDialogOpen,
        selectedEvent, setSelectedEvent,
        eventMutation,
        cancelMutation,
        rescheduleMutation,
        retryMutation,
        isUploading,
    };
};
