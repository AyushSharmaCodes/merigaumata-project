import { useTestimonialsManagement } from "@/features/admin";
import { Button } from "@/shared/components/ui/button";
import { ReviewSkeleton } from "@/shared/components/ui/page-skeletons";
import { Plus } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
} from "@/shared/components/ui/alert-dialog";

// Sub-components
import { TestimonialCard } from "@/features/admin";
import { TestimonialDialog } from "@/features/admin";

export default function TestimonialsManagement() {
    const {
        t,
        testimonials,
        isLoading,
        dialogOpen, setDialogOpen,
        editingTestimonial,
        deleteId, setDeleteId,
        canAdd,
        canApprove,
        formData, setFormData,
        images, setImages,
        isUploading,
        saveMutation,
        deleteMutation,
        handleEdit,
        handleSubmit,
        resetForm,
    } = useTestimonialsManagement();

    if (isLoading) {
        return <div className="p-8"><ReviewSkeleton /></div>;
    }

    return (
        <>
            <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">{t("admin.testimonials.title")}</h1>
                        <p className="text-muted-foreground">{t("admin.testimonials.subtitle")}</p>
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
                        <TestimonialCard
                            key={testimonial.id}
                            testimonial={testimonial}
                            canApprove={canApprove}
                            canAdd={canAdd}
                            onEdit={handleEdit}
                            onDelete={(id) => setDeleteId(id)}
                        />
                    ))}
                </div>

                {testimonials.length === 0 && (
                    <div className="text-center py-12 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">{t("admin.testimonials.noTestimonials")}</p>
                    </div>
                )}

                <TestimonialDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    editingTestimonial={editingTestimonial}
                    formData={formData}
                    setFormData={setFormData}
                    images={images}
                    setImages={setImages}
                    onSubmit={handleSubmit}
                    isSaving={saveMutation.isPending}
                    isUploading={isUploading}
                    canApprove={canApprove}
                />

                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t("admin.testimonials.deleteTitle")}</AlertDialogTitle>
                            <AlertDialogDescription>{t("admin.testimonials.deleteDescription")}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? t("common.deleting") : t("common.delete")}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </>
    );
}
