import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { blogService } from "@/domains/content";
import { uploadService } from "@/core/upload/upload-client";
import { toast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { logger } from "@/core/observability/logger";
import { getBlogUploadFolder } from "@/core/upload/upload-utils";
import type { Blog } from "@/shared/types";

export const useBlogsManagement = () => {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const limit = 10;

    const [blogDialogOpen, setBlogDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedBlog, setSelectedBlog] = useState<Blog | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ["admin-blogs", page, limit, searchQuery, i18n.language],
        queryFn: () => blogService.getPaginated(page, limit, searchQuery),
    });

    const blogs = data?.blogs || [];
    const totalPages = data?.totalPages || 0;

    const blogMutation = useMutation({
        meta: { blocking: true },
        mutationFn: async (blogData: Partial<Blog> & { imageFile?: File; replacedImageUrl?: string }) => {
            const finalBlog = { ...blogData };
            if (blogData.imageFile) {
                const response = await uploadService.uploadImage(
                    blogData.imageFile,
                    'blog',
                    getBlogUploadFolder({
                        title: finalBlog.title || selectedBlog?.title,
                        title_i18n: finalBlog.title_i18n || selectedBlog?.title_i18n,
                        blog_code: finalBlog.blog_code || selectedBlog?.blog_code
                    })
                );
                finalBlog.image = response.url;
                delete finalBlog.imageFile;
            }

            try {
                if (finalBlog.id) {
                    return await blogService.update(finalBlog.id, finalBlog);
                } else {
                    return await blogService.create(finalBlog as Omit<Blog, "id">);
                }
            } catch (error) {
                if (finalBlog.image && blogData.imageFile) {
                    try {
                        await uploadService.deleteImageByUrl(finalBlog.image);
                    } catch (cleanupError) {
                        logger.error("Failed to cleanup orphaned blog image", { cleanupError });
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
                    logger.error("Failed to cleanup replaced blog image", { cleanupError });
                }
            }
            queryClient.invalidateQueries({ queryKey: ["admin-blogs"] });
            toast({
                title: t("common.success"),
                description: selectedBlog ? t("admin.blogs.toasts.updateSuccess") : t("admin.blogs.toasts.createSuccess"),
            });
            setBlogDialogOpen(false);
            setSelectedBlog(null);
        },
        onError: (error: unknown) => {
            toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        meta: { blocking: true },
        mutationFn: (blogId: string) => blogService.delete(blogId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-blogs"] });
            toast({ title: t("common.success"), description: t("admin.blogs.toasts.deleteSuccess") });
            setDeleteDialogOpen(false);
            setSelectedBlog(null);
        },
        onError: (error: unknown) => {
            toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" });
        },
    });

    const togglePublishMutation = useMutation({
        meta: { blocking: true },
        mutationFn: ({ id, published }: { id: string; published: boolean }) => blogService.update(id, { published }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-blogs"] });
            toast({ title: t("common.success"), description: t("admin.blogs.toasts.statusSuccess") });
        },
        onError: (error: unknown) => {
            toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" });
        },
    });

    return {
        t,
        searchQuery, setSearchQuery,
        page, setPage,
        blogs, totalPages,
        isLoading,
        blogDialogOpen, setBlogDialogOpen,
        deleteDialogOpen, setDeleteDialogOpen,
        selectedBlog, setSelectedBlog,
        blogMutation,
        deleteMutation,
        togglePublishMutation,
    };
};
