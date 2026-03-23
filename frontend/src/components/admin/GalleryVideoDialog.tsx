import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { galleryVideoService, GalleryVideo } from "@/services/gallery-video.service";
import { galleryFolderService } from "@/services/gallery-folder.service";
import { toast } from "sonner";
import { I18nInput } from "./I18nInput";

interface GalleryVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video?: GalleryVideo | null;
  defaultFolderId?: string;
}

export function GalleryVideoDialog({
  open,
  onOpenChange,
  video,
  defaultFolderId,
}: GalleryVideoDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    folder_id: defaultFolderId || "",
    youtube_url: "",
    title: "",
    title_i18n: {} as Record<string, string>,
    description: "",
    description_i18n: {} as Record<string, string>,
    tags: [] as string[],
  });
  const [extractedId, setExtractedId] = useState("");

  // Fetch folders for selection
  const { data: folders = [] } = useQuery({
    queryKey: ["gallery-folders"],
    queryFn: galleryFolderService.getAll,
  });

  useEffect(() => {
    if (video) {
      setFormData({
        folder_id: video.folder_id,
        youtube_url: video.youtube_url,
        title: video.title || "",
        title_i18n: video.title_i18n || {},
        description: video.description || "",
        description_i18n: video.description_i18n || {},
        tags: video.tags || [],
      });
      setExtractedId(video.youtube_id);
    } else if (!open) {
      setFormData({
        folder_id: defaultFolderId || "",
        youtube_url: "",
        title: "",
        title_i18n: {},
        description: "",
        description_i18n: {},
        tags: [],
      });
      setExtractedId("");
    }
  }, [video, open, defaultFolderId]);

  const extractYouTubeId = (url: string): string => {
    if (!url) return "";

    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return url;
  };

  const handleUrlChange = (url: string) => {
    setFormData({ ...formData, youtube_url: url });
    const id = extractYouTubeId(url);
    setExtractedId(id);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const videoData = {
        folder_id: formData.folder_id,
        youtube_url: formData.youtube_url,
        title: formData.title,
        title_i18n: formData.title_i18n,
        description: formData.description,
        description_i18n: formData.description_i18n,
        tags: formData.tags,
      };

      if (video) {
        return galleryVideoService.update(video.id, videoData);
      } else {
        return galleryVideoService.create(videoData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gallery-videos-all"] });
      queryClient.invalidateQueries({ queryKey: ["gallery-videos"] });
      queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
      toast.success(
        video ? t("admin.gallery.toasts.videoUpdated") : t("admin.gallery.toasts.videoCreated")
      );
      onOpenChange(false);
    },
    onError: () => {
      toast.error(video ? t("admin.gallery.toasts.saveVideoError") : t("admin.gallery.toasts.saveVideoError"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.folder_id) {
      toast.error(t("admin.gallery.toasts.requiredFolder"));
      return;
    }

    if (!extractedId) {
      toast.error(t("admin.gallery.toasts.requiredYoutubeUrl"));
      return;
    }

    if (!formData.title.trim()) {
      toast.error(t("admin.gallery.toasts.requiredTitle"));
      return;
    }

    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {video ? t("admin.gallery.dialog.editVideo") : t("admin.gallery.dialog.addVideo")}
          </DialogTitle>
          <DialogDescription>
            {video
              ? t("admin.gallery.dialog.editVideoDesc")
              : t("admin.gallery.dialog.addVideoDesc")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-2">
          {/* Video Preview */}
          {extractedId && (
            <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
              <Label className="text-base font-semibold">{t("admin.gallery.dialog.videoPreview")}</Label>
              <div className="aspect-video rounded-md overflow-hidden bg-black">
                <iframe
                  src={`${import.meta.env.VITE_YOUTUBE_EMBED_URL || "https://www.youtube.com/embed"}/${extractedId}`}
                  title={t("admin.gallery.dialog.videoPreview")}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Folder Selection */}
          <div className="space-y-2">
            <Label htmlFor="folder">
              {t("admin.gallery.folder")} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.folder_id}
              onValueChange={(value) =>
                setFormData({ ...formData, folder_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("admin.gallery.toasts.requiredFolder")} />
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name} ({folder.category_name || t("common.general")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Video URL */}
          {!video && (
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">{t("admin.gallery.dialog.youtubeUrl")}</h3>

              <div className="space-y-2">
                <Label htmlFor="youtubeUrl">
                  {t("admin.gallery.dialog.youtubeUrl")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="youtubeUrl"
                  value={formData.youtube_url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                />
                <p className="text-sm text-muted-foreground">
                  {t("admin.gallery.dialog.youtubeUrlHelp")}
                </p>
              </div>
            </div>
          )}

          {/* Video Information */}
          <div className="space-y-4 border rounded-lg p-4">
            <h3 className="text-base font-semibold">{t("admin.gallery.dialog.videoInformation")}</h3>

            <div className="space-y-2">
              <Label htmlFor="title">
                {t("common.title")} <span className="text-destructive">*</span>
              </Label>
              <I18nInput
                label={t("common.title")}
                value={formData.title}
                i18nValue={formData.title_i18n}
                onChange={(title, title_i18n) =>
                  setFormData({ ...formData, title, title_i18n })
                }
                placeholder={t("common.titlePlaceholder")}
                required
                id="title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t("admin.gallery.dialog.description")} ({t("common.optional")})</Label>
              <I18nInput
                label={t("admin.gallery.dialog.description")}
                type="textarea"
                value={formData.description}
                i18nValue={formData.description_i18n}
                onChange={(description, description_i18n) =>
                  setFormData({ ...formData, description, description_i18n })
                }
                placeholder={t("admin.gallery.dialog.descPlaceholder")}
                rows={4}
                id="description"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? t("common.saving")
                : video
                  ? t("admin.gallery.toasts.videoUpdated")
                  : t("admin.gallery.addVideo")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
