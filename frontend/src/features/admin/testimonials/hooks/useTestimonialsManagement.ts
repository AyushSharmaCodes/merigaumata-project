import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { testimonialService } from "@/domains/content";
import { uploadService } from "@/core/upload/upload-client";
import { Testimonial } from "@/shared/types";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { logger } from "@/core/observability/logger";
import { useManagerPermissions } from "@/shared/hooks/useManagerPermissions";
import { getTestimonialUploadFolder } from "@/core/upload/upload-utils";

export const useTestimonialsManagement = () => {
    const { t, i18n } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { hasPermission } = useManagerPermissions();

    const canManage = hasPermission("can_manage_testimonials");
    const canAdd = canManage || hasPermission("can_add_testimonials");
    const canApprove = canManage || hasPermission("can_approve_testimonials");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const [isOperationLoading, setIsOperationLoading] = useState(false);

    const [formData, setFormData] = useState<Partial<Testimonial>>({
        name: "",
        name_i18n: {},
        role: "",
        role_i18n: {},
        content: "",
        content_i18n: {},
        rating: 5,
        image: "",
        approved: canApprove,
    });
    const [images, setImages] = useState<(File | string)[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const { data: testimonials = [], isLoading } = useQuery({
        queryKey: ["admin-testimonials", i18n.language],
        queryFn: () => testimonialService.getAll({ isAdmin: true }),
    });

    const resetForm = () => {
        setFormData({
            name: "",
            name_i18n: {},
            role: "",
            role_i18n: {},
            content: "",
            content_i18n: {},
            rating: 5,
            image: "",
            approved: canApprove,
        });
        setImages([]);
        setEditingTestimonial(null);
    };

    const saveMutation = useMutation({
        mutationFn: async (data: Partial<Testimonial> & { imageFile?: File }) => {
            const finalData = { ...data };
            let uploadedImageUrl: string | null = null;

            if (data.imageFile) {
                const response = await uploadService.uploadImage(
                    data.imageFile,
                    'testimonial',
                    getTestimonialUploadFolder({
                        name: finalData.name || editingTestimonial?.name,
                        name_i18n: finalData.name_i18n || editingTestimonial?.name_i18n
                    })
                );
                finalData.image = response.url;
                uploadedImageUrl = response.url;
                delete finalData.imageFile;
            }

            try {
                if (editingTestimonial) {
                    setLoadingMessage(t("admin.testimonials.updating"));
                    setIsOperationLoading(true);
                    return await testimonialService.update(editingTestimonial.id, finalData);
                } else {
                    setLoadingMessage(t("admin.testimonials.creating"));
                    setIsOperationLoading(true);
                    return await testimonialService.create(finalData);
                }
            } catch (error) {
                if (uploadedImageUrl) {
                    try {
                        await uploadService.deleteImageByUrl(uploadedImageUrl);
                    } catch (cleanupError) {
                        logger.error("Failed to delete orphaned testimonial image", { cleanupError, uploadedImageUrl });
                    }
                }
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
            queryClient.invalidateQueries({ queryKey: ["testimonials"] });
            toast({
                title: t("common.success"),
                description: editingTestimonial ? t("admin.testimonials.updated") : t("admin.testimonials.created"),
            });
            setDialogOpen(false);
            resetForm();
            setIsOperationLoading(false);
        },
        onError: (error: unknown) => {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.testimonials.error"),
                variant: "destructive",
            });
            setIsOperationLoading(false);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => {
            setLoadingMessage(t("admin.testimonials.deleting"));
            setIsOperationLoading(true);
            return testimonialService.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
            queryClient.invalidateQueries({ queryKey: ["testimonials"] });
            toast({
                title: t("common.success"),
                description: t("admin.testimonials.deleted"),
            });
            setDeleteId(null);
            setIsOperationLoading(false);
        },
        onError: (error: unknown) => {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.testimonials.deleteError"),
                variant: "destructive",
            });
            setDeleteId(null);
            setIsOperationLoading(false);
        },
    });

    const handleEdit = (testimonial: Testimonial) => {
        setEditingTestimonial(testimonial);
        setFormData({
            name: testimonial.name || "",
            name_i18n: testimonial.name_i18n || {},
            role: testimonial.role || "",
            role_i18n: testimonial.role_i18n || {},
            content: testimonial.content || "",
            content_i18n: testimonial.content_i18n || {},
            rating: testimonial.rating || 5,
            image: testimonial.image || "",
            approved: testimonial.approved ?? false,
        });
        setImages(testimonial.image ? [testimonial.image] : []);
        setDialogOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const submitData: Partial<Testimonial> & { imageFile?: File } = { ...formData };
        if (images.length > 0 && images[0] instanceof File) {
            submitData.imageFile = images[0];
        } else if (images.length === 0) {
            submitData.image = "";
        }
        saveMutation.mutate(submitData);
    };

    return {
        t,
        testimonials,
        isLoading,
        dialogOpen, setDialogOpen,
        editingTestimonial,
        deleteId, setDeleteId,
        loadingMessage,
        isOperationLoading,
        canAdd,
        canApprove,
        formData, setFormData,
        images, setImages,
        isUploading, setIsUploading,
        saveMutation,
        deleteMutation,
        handleEdit,
        handleSubmit,
        resetForm,
    };
};
