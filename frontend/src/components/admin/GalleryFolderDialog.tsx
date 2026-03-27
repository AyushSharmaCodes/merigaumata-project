import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GalleryFolder } from "@/services/gallery-folder.service";
import { getLocalizedContent } from "@/utils/localizationUtils";
import { useQuery } from "@tanstack/react-query";
import { categoryService } from "@/services/category.service";
import { I18nInput } from "./I18nInput";

interface GalleryFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: GalleryFolder | null;
  onSave: (folder: Partial<GalleryFolder>) => void;
}

export function GalleryFolderDialog({
  open,
  onOpenChange,
  folder,
  onSave,
}: GalleryFolderDialogProps) {
  const { t, i18n } = useTranslation();
  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["categories", "gallery"],
    queryFn: () => categoryService.getAll("gallery"),
  });

  const [formData, setFormData] = useState<Partial<GalleryFolder>>({
    name: "",
    name_i18n: {},
    description: "",
    description_i18n: {},
    slug: "",
    category_id: "",
    is_active: true,
    is_hidden: false,
    order_index: 0,
  });

  useEffect(() => {
    if (folder) {
      setFormData(folder);
    } else {
      setFormData({
        name: "",
        name_i18n: {},
        description: "",
        description_i18n: {},
        slug: "",
        category_id: "",
        is_active: true,
        is_hidden: false,
        order_index: 0,
      });
    }
  }, [folder, open]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleNameChange = (name: string, name_i18n: Record<string, string>) => {
    setFormData({
      ...formData,
      name,
      name_i18n,
      slug: folder ? formData.slug : generateSlug(name),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name?.trim()) {
      alert(t("admin.gallery.toasts.requiredName"));
      return;
    }

    if (!formData.slug?.trim()) {
      alert(t("admin.gallery.toasts.requiredSlug"));
      return;
    }

    onSave({
      ...formData,
      id: folder?.id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {folder ? t("admin.gallery.dialog.editFolder") : t("admin.gallery.dialog.createFolder")}
          </DialogTitle>
          <DialogDescription>
            {folder
              ? t("admin.gallery.dialog.editFolderDesc")
              : t("admin.gallery.dialog.createFolderDesc")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                {t("admin.gallery.dialog.folderName")} <span className="text-red-600">*</span>
              </Label>
              <I18nInput
                label={t("admin.gallery.dialog.folderName")}
                value={formData.name || ""}
                i18nValue={formData.name_i18n}
                onChange={handleNameChange}
                placeholder={t("admin.gallery.dialog.folderNamePlaceholder")}
                required
                id="name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">
                {t("admin.gallery.dialog.urlSlug")} <span className="text-red-600">*</span>
              </Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="summer-festival-2024"
                required
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.gallery.dialog.urlSlugHelp")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t("admin.gallery.dialog.folderType")}</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, category_id: value })
                }
              >
                <SelectTrigger aria-label={t("admin.gallery.dialog.folderType")}>
                  <SelectValue placeholder={t("admin.gallery.dialog.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.length > 0 ? (
                    categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {getLocalizedContent(category, i18n.language)}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>{t("admin.allCategories.noCategoriesFound")}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("admin.gallery.dialog.description")}</Label>
              <I18nInput
                label={t("admin.gallery.dialog.description")}
                type="textarea"
                value={formData.description || ""}
                i18nValue={formData.description_i18n}
                onChange={(description, description_i18n) =>
                  setFormData({ ...formData, description, description_i18n })
                }
                placeholder={t("admin.gallery.dialog.descPlaceholder")}
                rows={3}
                id="description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_index">{t("admin.gallery.dialog.displayOrder")}</Label>
              <Input
                id="order_index"
                type="number"
                value={formData.order_index}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    order_index: parseInt(e.target.value) || 0,
                  })
                }
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.gallery.dialog.displayOrderHelp")}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label>{t("admin.gallery.dialog.active")}</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t("admin.gallery.dialog.hideFromGallery")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("admin.gallery.dialog.hideHelp")}
                </p>
              </div>
              <Switch
                id="is_hidden"
                checked={formData.is_hidden}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_hidden: checked })
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit">
              {folder ? t("admin.gallery.dialog.editFolder") : t("admin.gallery.dialog.createFolder")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
