import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Star } from "lucide-react";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { ImageUpload } from "@/features/admin";
import { I18nInput } from "@/features/admin";
import { useTranslation } from "react-i18next";
import { Testimonial } from "@/shared/types";

interface TestimonialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTestimonial: Testimonial | null;
  formData: Partial<Testimonial>;
  setFormData: (data: Partial<Testimonial>) => void;
  images: (File | string)[];
  setImages: (images: (File | string)[]) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
  isUploading: boolean;
  canApprove: boolean;
}

export const TestimonialDialog = ({
  open,
  onOpenChange,
  editingTestimonial,
  formData,
  setFormData,
  images,
  setImages,
  onSubmit,
  isSaving,
  isUploading,
  canApprove,
}: TestimonialDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[500px]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {editingTestimonial ? t("admin.testimonials.edit") : t("admin.testimonials.add")}
          </DialogTitle>
          <DialogDescription>
            {t("admin.testimonials.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("admin.testimonials.uploadImage")}</Label>
            <ImageUpload
              images={images}
              onChange={(newImages) => {
                setImages(newImages);
                if (newImages.length === 0) {
                  setFormData({ ...formData, image: "" });
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
                  className={`p-1 rounded-full hover:bg-muted transition-colors ${(formData.rating || 0) >= star ? "text-yellow-400" : "text-gray-300"}`}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSaving || isUploading}>
              {isSaving || isUploading ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
