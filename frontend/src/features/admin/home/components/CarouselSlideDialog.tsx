import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { Switch } from "@/shared/components/ui/switch";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { ImageUpload, I18nInput } from "@/features/admin";
import { HeroCarouselSlide } from "@/shared/types";
import {
  createCarouselSlide,
  updateCarouselSlide,
} from "@/domains/content/services/home/carousel.service";
import { logger } from "@/core/observability/logger";
import { useToast } from "@/shared/hooks/use-toast";
import { uploadService } from "@/core/upload/upload-client";
import { getCarouselUploadFolder } from "@/core/upload/upload-utils";

interface CarouselSlideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slide?: HeroCarouselSlide | null;
}

export function CarouselSlideDialog({
  open,
  onOpenChange,
  slide,
}: CarouselSlideDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState<{
    image: string;
    title: string;
    title_i18n: Record<string, string>;
    subtitle: string;
    subtitle_i18n: Record<string, string>;
    order: number;
    isActive: boolean;
    imageFile?: File;
  }>({
    image: "",
    title: "",
    title_i18n: {},
    subtitle: "",
    subtitle_i18n: {},
    order: 0,
    isActive: true,
    imageFile: undefined,
  });

  useEffect(() => {
    if (slide) {
      setFormData({
        image: slide.image,
        title: slide.title || "",
        title_i18n: slide.title_i18n || {},
        subtitle: slide.subtitle || "",
        subtitle_i18n: slide.subtitle_i18n || {},
        order: slide.order,
        isActive: slide.isActive,
      });
    } else {
      setFormData({
        image: "",
        title: "",
        title_i18n: {},
        subtitle: "",
        subtitle_i18n: {},
        order: 0,
        isActive: true,
        imageFile: undefined,
      });
    }
  }, [slide, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!formData.image && !formData.imageFile) {
        throw new Error(t("admin.carousel.toasts.imageRequired"));
      }

      let imageUrl = formData.image;
      if (formData.imageFile) {
        const response = await uploadService.uploadImage(formData.imageFile, 'carousel', getCarouselUploadFolder());
        imageUrl = response.url;
      }

      const slideData = {
        image: imageUrl,
        title: formData.title.trim() || undefined,
        title_i18n: formData.title_i18n,
        subtitle: formData.subtitle.trim() || undefined,
        subtitle_i18n: formData.subtitle_i18n,
        order: formData.order,
        isActive: formData.isActive,
      };

      try {
        if (slide) {
          return await updateCarouselSlide(slide.id, slideData);
        } else {
          return await createCarouselSlide(slideData);
        }
      } catch (error) {
        // Cleanup image if database operation fails
        if (formData.imageFile && imageUrl) {
          logger.warn("Carousel slide save failed, cleaning up image", { imageUrl, error });
          try {
            await uploadService.deleteImageByUrl(imageUrl);
          } catch (cleanupError) {
            logger.error("Failed to cleanup carousel slide image", { cleanupError, imageUrl });
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carousel-slides"] });
      queryClient.invalidateQueries({ queryKey: ["carousel-slides-admin"] });
      toast({
        title: t("common.success"),
        description: slide
          ? t("admin.carousel.toasts.updateSuccess")
          : t("admin.carousel.toasts.createSuccess"),
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: t("admin.carousel.toasts.saveError"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {slide ? t("admin.carousel.dialog.editTitle") : t("admin.carousel.dialog.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {slide
              ? t("admin.carousel.dialog.descriptionEdit")
              : t("admin.carousel.dialog.descriptionAdd")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>
                {t("admin.carousel.dialog.image")} <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("admin.carousel.dialog.imageHint")}
              </p>
              <ImageUpload
                images={formData.imageFile ? [formData.imageFile] : (formData.image ? [formData.image] : [])}
                onChange={(images) => {
                  const img = images[0];
                  if (img instanceof File) {
                    setFormData((prev) => ({ ...prev, image: "", imageFile: img }));
                  } else {
                    setFormData((prev) => ({ ...prev, image: img || "", imageFile: undefined }));
                  }
                }}
                maxImages={1}
                type="carousel"
              />
            </div>

            {/* Content Section */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">{t("admin.carousel.dialog.contentSub")}</h4>
                <p className="text-xs text-muted-foreground">
                  {t("admin.carousel.dialog.contentHint")}
                </p>
              </div>

              {/* Title (Optional) */}
              <div className="space-y-2">
                <Label>
                  {t("admin.carousel.dialog.titlePrompt")}{" "}
                  <span className="text-muted-foreground">({t("common.optional")})</span>
                </Label>
                <I18nInput
                  label={`${t("admin.carousel.dialog.titlePrompt")} (${t("common.optional")})`}
                  value={formData.title}
                  i18nValue={formData.title_i18n}
                  onChange={(val, i18n) =>
                    setFormData((prev) => ({ ...prev, title: val, title_i18n: i18n }))
                  }
                  placeholder={t("admin.carousel.placeholder.title", { defaultValue: "e.g., Nurturing Tradition, Embracing Nature" })}
                />
              </div>

              {/* Subtitle (Optional) */}
              <div className="space-y-2">
                <Label>
                  {t("admin.carousel.dialog.subtitlePrompt")}{" "}
                  <span className="text-muted-foreground">({t("common.optional")})</span>
                </Label>
                <I18nInput
                  label={`${t("admin.carousel.dialog.subtitlePrompt")} (${t("common.optional")})`}
                  type="textarea"
                  value={formData.subtitle}
                  i18nValue={formData.subtitle_i18n}
                  onChange={(val, i18n) =>
                    setFormData((prev) => ({
                      ...prev,
                      subtitle: val,
                      subtitle_i18n: i18n,
                    }))
                  }
                  placeholder={t("admin.carousel.placeholder.subtitle", { defaultValue: "e.g., Pure products from happy, healthy cows" })}
                  rows={3}
                />
              </div>
            </div>

            {/* Display Settings */}
            <div className="space-y-4 border rounded-lg p-4">
              <h4 className="text-sm font-medium">{t("admin.carousel.dialog.displaySettings")}</h4>

              {/* Order */}
              <div className="space-y-2">
                <Label htmlFor="order">
                  {t("admin.carousel.dialog.displayOrder")} <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("admin.carousel.dialog.displayOrderHint")}
                </p>
                <Input
                  id="order"
                  type="number"
                  min="0"
                  value={formData.order}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      order: parseInt(e.target.value) || 0,
                    }))
                  }
                  required
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <Label>{t("admin.carousel.dialog.activeStatus")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.carousel.dialog.activeStatusHint")}
                  </p>
                </div>
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={mutation.isPending || (!formData.image && !formData.imageFile)}
          >
            {mutation.isPending
              ? (slide ? t("admin.carousel.dialog.updating") : t("admin.carousel.dialog.creating"))
              : slide
                ? t("admin.carousel.dialog.update")
                : t("admin.carousel.dialog.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
