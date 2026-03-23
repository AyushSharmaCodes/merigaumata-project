import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag } from "@/components/ui/Tag";
import { X, Plus } from "lucide-react";
import type { Blog } from "@/types";
import { ImageUpload } from "./ImageUpload";
import { uploadService } from "@/services/upload.service";
import { I18nInput } from "./I18nInput";

interface BlogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blog: Blog | null;
  onSave: (blog: Partial<Blog> & { imageFile?: File }) => void;
}

export function BlogDialog({
  open,
  onOpenChange,
  blog,
  onSave,
}: BlogDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<Blog> & { imageFile?: File }>({
    title: "",
    title_i18n: {},
    excerpt: "",
    excerpt_i18n: {},
    content: "",
    content_i18n: {},
    author: "",
    author_i18n: {},
    image: "",
    tags: [],
    tags_i18n: {},
    published: false,
    imageFile: undefined,
  });

  const [tagInput, setTagInput] = useState("");
  const [activeTagLang, setActiveTagLang] = useState("en");
  const [originalImage, setOriginalImage] = useState<string | undefined>();

  useEffect(() => {
    if (blog) {
      setOriginalImage(blog.image);
      setFormData({
        ...blog,
        imageFile: undefined,
        tags: blog.tags || [],
        tags_i18n: blog.tags_i18n || {},
      });
    } else {
      setOriginalImage(undefined);
      setFormData({
        title: "",
        title_i18n: {},
        excerpt: "",
        excerpt_i18n: {},
        content: "",
        content_i18n: {},
        author: "",
        author_i18n: {},
        image: "",
        tags: [],
        tags_i18n: {},
        published: false,
        date: new Date().toISOString(),
        imageFile: undefined,
      });
    }
  }, [blog, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.title?.trim() ||
      !formData.author?.trim() ||
      !formData.excerpt?.trim() ||
      !formData.content?.trim()
    ) {
      toast({
        title: t("common.error"),
        description: t("admin.blogs.toasts.requiredFields"),
        variant: "destructive",
      });
      return;
    }

    // Check for either existing image or new image file
    if (!formData.image?.trim() && !formData.imageFile) {
      toast({
        title: t("common.error"),
        description: t("admin.blogs.toasts.uploadImage"),
        variant: "destructive",
      });
      return;
    }

    // Delete old image if it was replaced
    if (originalImage && formData.imageFile instanceof File) {
      logger.debug("Deleting replaced blog image:", originalImage);
      try {
        await uploadService.deleteImageByUrl(originalImage);
        logger.debug("Successfully deleted old blog image:", originalImage);
      } catch (error) {
        logger.error("Failed to delete old blog image: " + originalImage, error);
        // Continue even if deletion fails
      }
    }

    onSave({
      ...formData,
      imageFile: formData.imageFile instanceof File ? formData.imageFile : undefined,
      id: blog?.id,
      date: blog?.date || new Date().toISOString(),
    });
  };

  const addTag = () => {
    if (!tagInput.trim()) return;

    if (activeTagLang === "en") {
      if (!formData.tags?.includes(tagInput.trim())) {
        const newTags = [...(formData.tags || []), tagInput.trim()];
        setFormData({
          ...formData,
          tags: newTags,
          tags_i18n: { ...formData.tags_i18n, en: newTags },
        });
      }
    } else {
      const currentLangTags = formData.tags_i18n?.[activeTagLang] || [];
      if (!currentLangTags.includes(tagInput.trim())) {
        const newLangTags = [...currentLangTags, tagInput.trim()];
        setFormData({
          ...formData,
          tags_i18n: { ...formData.tags_i18n, [activeTagLang]: newLangTags },
        });
      }
    }
    setTagInput("");
  };

  const removeTag = (tagToRemove: string, lang: string) => {
    if (lang === "en") {
      const newTags = formData.tags?.filter((tag) => tag !== tagToRemove) || [];
      setFormData({
        ...formData,
        tags: newTags,
        tags_i18n: { ...formData.tags_i18n, en: newTags },
      });
    } else {
      const currentLangTags = formData.tags_i18n?.[lang] || [];
      const newLangTags = currentLangTags.filter((tag) => tag !== tagToRemove);
      setFormData({
        ...formData,
        tags_i18n: { ...formData.tags_i18n, [lang]: newLangTags },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {blog ? t("admin.blogs.dialog.editTitle") : t("admin.blogs.dialog.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {blog
              ? t("admin.blogs.dialog.editDesc")
              : t("admin.blogs.dialog.addDesc")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Blog Image */}
            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {t("admin.blogs.dialog.image")}
                </h3>
                <span className="text-xs text-red-600">
                  {t("admin.blogs.dialog.imageRequired")}
                </span>
              </div>
              <ImageUpload
                images={
                  formData.imageFile
                    ? [formData.imageFile]
                    : formData.image
                      ? [formData.image]
                      : []
                }
                onChange={(images) => {
                  const firstImage = images[0];
                  if (firstImage instanceof File) {
                    setFormData({ ...formData, imageFile: firstImage, image: undefined });
                  } else if (typeof firstImage === 'string') {
                    setFormData({ ...formData, image: firstImage, imageFile: undefined });
                  } else {
                    setFormData({ ...formData, imageFile: undefined, image: undefined });
                  }
                }}
                maxImages={1}
                type="blog"
              />
            </div>

            {/* Basic Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {t("admin.blogs.dialog.basicInfo")}
              </h3>

              <div className="space-y-2">
                <I18nInput
                  label={t("admin.blogs.dialog.blogTitle")}
                  value={formData.title || ""}
                  i18nValue={formData.title_i18n || {}}
                  onChange={(val, i18nVal) => setFormData({ ...formData, title: val, title_i18n: i18nVal })}
                  placeholder={t("admin.blogs.dialog.blogTitlePlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <I18nInput
                  label={t("admin.blogs.dialog.authorName")}
                  value={formData.author || ""}
                  i18nValue={formData.author_i18n || {}}
                  onChange={(val, i18nVal) => setFormData({ ...formData, author: val, author_i18n: i18nVal })}
                  placeholder={t("admin.blogs.dialog.authorPlaceholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <I18nInput
                  label={t("admin.blogs.dialog.excerpt")}
                  type="textarea"
                  value={formData.excerpt || ""}
                  i18nValue={formData.excerpt_i18n || {}}
                  onChange={(val, i18nVal) => setFormData({ ...formData, excerpt: val, excerpt_i18n: i18nVal })}
                  placeholder={t("admin.blogs.dialog.excerptHelp")}
                  rows={3}
                  required
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-xs text-muted-foreground">
                    {t("admin.blogs.dialog.excerptListing")}
                  </p>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                    {formData.excerpt?.length || 0}/200 {t("common.characters")}
                  </span>
                </div>
              </div>
            </div>

            {/* Blog Content */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {t("admin.blogs.dialog.blogContent")}
              </h3>

              <div className="space-y-2">
                <I18nInput
                  label={t("admin.blogs.dialog.content")}
                  type="textarea"
                  value={formData.content || ""}
                  i18nValue={formData.content_i18n || {}}
                  onChange={(val, i18nVal) => setFormData({ ...formData, content: val, content_i18n: i18nVal })}
                  placeholder={t("admin.blogs.dialog.contentPlaceholder")}
                  rows={12}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t("admin.blogs.dialog.contentHelp")}
                </p>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">{t("admin.blogs.dialog.tags")}</h3>

              <Tabs value={activeTagLang} onValueChange={setActiveTagLang} className="w-full">
                <TabsList className="h-8 p-0.5 bg-muted/50 mb-4">
                  {["en", "hi", "ta", "te"].map((lang) => (
                    <TabsTrigger
                      key={lang}
                      value={lang}
                      className="h-7 px-3 text-[11px] uppercase font-bold tracking-wider data-[state=active]:bg-background"
                    >
                      {lang}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {["en", "hi", "ta", "te"].map((lang) => (
                  <TabsContent key={lang} value={lang} className="space-y-4 mt-0">
                    <div className="flex gap-2">
                      <Input
                        placeholder={`${t("admin.blogs.dialog.addTag")} (${lang.toUpperCase()})`}
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={addTag}
                        size="icon"
                        variant="outline"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(lang === "en" ? (formData.tags || []) : (formData.tags_i18n?.[lang] || [])).map((tag) => (
                        <Tag
                          key={tag}
                          variant="default"
                          size="default"
                          className="px-3 py-1"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag, lang)}
                            className="ml-2 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Tag>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            {/* Publish Settings */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {t("admin.blogs.dialog.publishSettings")}
              </h3>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="published"
                  checked={formData.published}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, published: checked as boolean })
                  }
                />
                <div className="space-y-0.5">
                  <Label
                    htmlFor="published"
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {t("admin.blogs.dialog.publishImmediately")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.published
                      ? t("admin.blogs.dialog.publishedHelp")
                      : t("admin.blogs.dialog.draftHelp")}
                  </p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground pt-2 border-t">
                <p>
                  <strong>{t("admin.blogs.dialog.postDate")}:</strong>{" "}
                  {blog?.date
                    ? new Date(blog.date).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                    : t("admin.blogs.dialog.postDateCreated")}
                </p>
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
                {blog ? t("admin.blogs.dialog.editTitle") : t("admin.blogs.dialog.addTitle")}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
