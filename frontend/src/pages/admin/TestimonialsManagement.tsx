import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { uploadService } from "@/services/upload.service";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
    Plus,
    Trash2,
    Edit,
    Star,
    Quote,
    CheckCircle2,
    ShieldAlert,
} from "lucide-react";
import { testimonialService } from "@/services/testimonial.service";
import { Testimonial } from "@/types";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { logger } from "@/lib/logger";
import { useManagerPermissions } from "@/hooks/useManagerPermissions";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { I18nInput } from "@/components/admin/I18nInput";

export default function TestimonialsManagement() {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const [isOperationLoading, setIsOperationLoading] = useState(false);

    const { hasPermission, isAdmin } = useManagerPermissions();

    const canManage = hasPermission("can_manage_testimonials");
    const canAdd = canManage || hasPermission("can_add_testimonials");
    const canApprove = canManage || hasPermission("can_approve_testimonials");

    // Form state
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

    // Fetch testimonials
    const { data: testimonials = [], isLoading } = useQuery({
        queryKey: ["admin-testimonials", i18n.language],
        queryFn: () => testimonialService.getAll({ isAdmin: true }),
    });

    // Mutations
    const saveMutation = useMutation({
        mutationFn: async (data: Partial<Testimonial> & { imageFile?: File }) => {
            const finalData = { ...data };
            let uploadedImageUrl: string | null = null;

            // Handle image upload if provided
            if (data.imageFile) {
                const response = await uploadService.uploadImage(data.imageFile, 'testimonial');
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
                // Cleanup image if database operation fails
                if (uploadedImageUrl) {
                    logger.warn("Testimonial save failed, deleting orphaned image", { uploadedImageUrl, error });
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
            toast.success(editingTestimonial ? t("admin.testimonials.updated") : t("admin.testimonials.created"));
            setDialogOpen(false);
            resetForm();
            setIsOperationLoading(false);
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, t, "admin.testimonials.error"));
            setIsOperationLoading(false);
        },
    });

    // ... (keep deleteMutation as is) ...

    const deleteMutation = useMutation({
        mutationFn: (id: string) => {
            setLoadingMessage(t("admin.testimonials.deleting"));
            setIsOperationLoading(true);
            return testimonialService.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
            queryClient.invalidateQueries({ queryKey: ["testimonials"] });
            toast.success(t("admin.testimonials.deleted"));
            setDeleteId(null);
            setIsOperationLoading(false);
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, t, "admin.testimonials.deleteError"));
            setDeleteId(null);
            setIsOperationLoading(false);
        },
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

    const handleDeleteClick = (id: string) => {
        setDeleteId(id);
    };

    const confirmDelete = () => {
        if (deleteId) {
            deleteMutation.mutate(deleteId);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prepare data with image file if present
        const submitData: Partial<Testimonial> & { imageFile?: File } = {
            ...formData
        };

        if (images.length > 0 && images[0] instanceof File) {
            submitData.imageFile = images[0];
        } else if (images.length === 0) {
            submitData.image = ""; // Clear image if removed
        }

        saveMutation.mutate(submitData);
    };

    if (isLoading) {
        return <LoadingOverlay isLoading={true} message={t("admin.testimonials.loading")} />;
    }

    return (
        <>
            <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{t("admin.testimonials.title")}</h1>
                        <p className="text-muted-foreground">
                            {t("admin.testimonials.subtitle")}
                        </p>
                    </div>
                    {canAdd && (
                        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
                            <Plus className="h-4 w-4 mr-2" />
                            {t("admin.testimonials.add")}
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {testimonials.map((testimonial) => (
                        <Card key={testimonial.id} className="relative group">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        {testimonial.image ? (
                                            <img
                                                src={testimonial.image}
                                                alt={testimonial.name}
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <span className="font-bold text-primary">{testimonial.name.charAt(0)}</span>
                                            </div>
                                        )}
                                        <div>
                                            <CardTitle className="text-base">{testimonial.name}</CardTitle>
                                            <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                                        </div>
                                    </div>
                                    <Badge
                                        variant="secondary"
                                        className={testimonial.approved
                                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                                            : "bg-amber-100 text-amber-800 hover:bg-amber-100"}
                                    >
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        {testimonial.approved ? t("common.approved") : t("common.pending", "Pending")}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {!canApprove && (
                                    <div className="flex items-center gap-1.5 text-[10px] text-amber-600 mb-2 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
                                        <ShieldAlert className="w-3 h-3" />
                                        <span>{t("admin.testimonials.approvalRestricted", { defaultValue: "Read-only access" })}</span>
                                    </div>
                                )}
                                <div className="flex mb-2">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star
                                            key={i}
                                            className={`w-4 h-4 ${i < (testimonial.rating || 5)
                                                ? "text-yellow-400 fill-yellow-400"
                                                : "text-gray-300"
                                                }`}
                                        />
                                    ))}
                                </div>
                                <div className="relative">
                                    <Quote className="h-6 w-6 text-muted-foreground/20 absolute -top-2 -left-2 transform -scale-x-100" />
                                    <p className="text-sm text-foreground/80 line-clamp-4 pl-4 italic">
                                        {testimonial.content}
                                    </p>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 mt-4 pt-4 border-t">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={() => handleEdit(testimonial)}
                                        disabled={!canApprove && (!canAdd || testimonial.approved)}
                                    >
                                        <Edit className="h-3 w-3 mr-2" />
                                        {t("common.edit")}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="flex-1"
                                        onClick={() => handleDeleteClick(testimonial.id)}
                                        disabled={!canApprove}
                                    >
                                        <Trash2 className="h-3 w-3 mr-2" />
                                        {t("common.delete")}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {testimonials.length === 0 && (
                    <div className="text-center py-12 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">
                            {t("admin.testimonials.noTestimonials")}
                        </p>
                    </div>
                )}

                {/* Add/Edit Dialog */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>
                                {editingTestimonial ? t("admin.testimonials.edit") : t("admin.testimonials.add")}
                            </DialogTitle>
                            <DialogDescription>
                                {t("admin.testimonials.description")}
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t("admin.testimonials.uploadImage")}</Label>
                                <ImageUpload
                                    images={images}
                                    onChange={(newImages) => {
                                        setImages(newImages);
                                        // If cleared, update form data immediately
                                        if (newImages.length === 0) {
                                            setFormData(prev => ({ ...prev, image: "" }));
                                        }
                                    }}
                                    maxImages={1}
                                    type="testimonial"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <I18nInput
                                        id="name"
                                        label={t("admin.testimonials.name")}
                                        required
                                        value={formData.name || ""}
                                        i18nValue={formData.name_i18n || {}}
                                        onChange={(value, i18nValue) => setFormData({ ...formData, name: value, name_i18n: i18nValue })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <I18nInput
                                        id="role"
                                        label={t("admin.testimonials.role")}
                                        required
                                        value={formData.role || ""}
                                        i18nValue={formData.role_i18n || {}}
                                        onChange={(value, i18nValue) => setFormData({ ...formData, role: value, role_i18n: i18nValue })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>{t("admin.testimonials.rating")}</Label>
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            type="button"
                                            key={star}
                                            onClick={() => setFormData({ ...formData, rating: star })}
                                            className={`p-1 rounded-full hover:bg-muted transition-colors ${(formData.rating || 0) >= star ? "text-yellow-400" : "text-gray-300"
                                                }`}
                                        >
                                            <Star className={`w-6 h-6 ${(formData.rating || 0) >= star ? "fill-current" : ""}`} />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <I18nInput
                                    id="content"
                                    label={t("admin.testimonials.content")}
                                    required
                                    type="textarea"
                                    rows={5}
                                    className="min-h-[100px]"
                                    value={formData.content || ""}
                                    i18nValue={formData.content_i18n || {}}
                                    onChange={(value, i18nValue) => setFormData({ ...formData, content: value, content_i18n: i18nValue })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t("admin.testimonials.autoTranslateNote")}
                                </p>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="approved"
                                    checked={!!formData.approved}
                                    disabled={!canApprove}
                                    onCheckedChange={(checked) =>
                                        setFormData({ ...formData, approved: checked === true })
                                    }
                                />
                                <Label>{t("common.approved")}</Label>
                            </div>

                            {!canApprove && (
                                <p className="text-xs text-amber-600 italic bg-amber-50 p-2 rounded border border-amber-100">
                                    {t("admin.testimonials.approvalRestrictedMsg", { defaultValue: "Note: You don't have approval permissions. Your changes will require admin review." })}
                                </p>
                            )}

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                    {t("common.cancel")}
                                </Button>
                                <Button type="submit" disabled={saveMutation.isPending || isUploading}>
                                    {saveMutation.isPending || isUploading ? t("common.saving") : t("common.save")}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Alert Dialog */}
                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("admin.testimonials.deleteTitle")}</AlertDialogTitle>
                            <AlertDialogDescription>
                                {t("admin.testimonials.deleteDescription")}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={confirmDelete}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? t("common.deleting") : t("common.delete")}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
            <LoadingOverlay isLoading={isOperationLoading} message={loadingMessage} />
        </>
    );
}
