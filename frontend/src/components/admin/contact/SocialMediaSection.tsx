import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, X, Loader2 } from "lucide-react";
import { SocialMediaLink } from "@/types/contact";
import { socialMediaService } from "@/services/social-media.service";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage, getFriendlyTitle } from "@/lib/errorUtils";
import { useTranslation } from "react-i18next";
import { DeleteConfirmDialog } from "../DeleteConfirmDialog";

const socialPlatforms = [
  { value: "facebook", label: "admin.contact.social.platforms.facebook", icon: "facebook" },
  { value: "instagram", label: "admin.contact.social.platforms.instagram", icon: "instagram" },
  { value: "youtube", label: "admin.contact.social.platforms.youtube", icon: "youtube" },
  { value: "twitter", label: "admin.contact.social.platforms.twitter", icon: "twitter" },
  { value: "linkedin", label: "admin.contact.social.platforms.linkedin", icon: "linkedin" },
  { value: "whatsapp", label: "admin.contact.social.platforms.whatsapp", icon: "phone" },
  { value: "telegram", label: "admin.contact.social.platforms.telegram", icon: "send" },
  { value: "other", label: "admin.contact.social.platforms.other", icon: "link" },
];

export function SocialMediaSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<Partial<SocialMediaLink>>({
    platform: "",
    url: "",
  });
  const [newLink, setNewLink] = useState<Partial<SocialMediaLink>>({
    platform: "",
    url: "",
  });
  const [isAdding, setIsAdding] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });

  // Fetch social media links
  const { data: socialMedia = [], isLoading } = useQuery({
    queryKey: ["admin-social-media"],
    queryFn: () => socialMediaService.getAll(true),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: socialMediaService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-social-media"] });
      setNewLink({ platform: "", url: "" });
      setIsAdding(false);
      toast({ title: t("common.success"), description: t("admin.contact.social.added") });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, t, "common.notice"),
        description: getErrorMessage(error, t, "admin.contact.social.addError"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SocialMediaLink> }) =>
      socialMediaService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-social-media"] });
      setEditingId(null);
      toast({ title: t("common.success"), description: t("admin.contact.social.updated") });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, t, "common.notice"),
        description: getErrorMessage(error, t, "admin.contact.social.updateError"),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: socialMediaService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-social-media"] });
      toast({ title: t("common.success"), description: t("admin.contact.social.removed") });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, t, "common.notice"),
        description: getErrorMessage(error, t, "admin.contact.social.removeError"),
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    if (!newLink.platform || !newLink.url) {
      toast({
        title: t("admin.contact.checkInfo"),
        description: t("admin.contact.fillFields"),
        variant: "destructive"
      });
      return;
    }
    createMutation.mutate(newLink);
  };

  const handleUpdate = (id: string, updates: Partial<SocialMediaLink>) => {
    updateMutation.mutate({ id, data: updates });
  };

  const handleDelete = (id: string) => {
    setDeleteDialog({ open: true, id });
  };

  const confirmDelete = () => {
    if (deleteDialog.id) {
      deleteMutation.mutate(deleteDialog.id);
      setDeleteDialog({ open: false, id: null });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">{t("admin.contact.loading.social")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("admin.contact.social.title")}</CardTitle>
          <Button type="button" onClick={() => setIsAdding(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t("admin.contact.social.add")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <h4 className="font-semibold">{t("admin.contact.social.addNew")}</h4>
            <div className="space-y-2">
              <Label>{t("admin.contact.social.platform")}</Label>
              <Select
                value={newLink.platform}
                onValueChange={(value) =>
                  setNewLink({ ...newLink, platform: value })
                }
              >
                <SelectTrigger aria-label={t("admin.contact.social.platform")}>
                  <SelectValue placeholder={t("admin.contact.social.selectPlatform")} />
                </SelectTrigger>
                <SelectContent>
                  {socialPlatforms.map((platform) => (
                    <SelectItem key={platform.value} value={platform.value}>
                      {t(platform.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("admin.contact.social.url")}</Label>
              <Input
                value={newLink.url}
                onChange={(e) =>
                  setNewLink({ ...newLink, url: e.target.value })
                }
                placeholder={t("admin.contact.social.urlPlaceholder")}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleAdd}
                size="sm"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {t("admin.contact.social.save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsAdding(false);
                  setNewLink({ platform: "", url: "" });
                }}
                size="sm"
              >
                <X className="h-4 w-4 mr-2" />
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {socialMedia.length === 0 && !isAdding ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t("admin.contact.social.empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {socialMedia.map((link) => (
              <div
                key={link.id}
                className="border rounded-lg p-4 space-y-3 bg-card"
              >
                {editingId === link.id ? (
                  <>
                    <div className="space-y-2">
                      <Label>{t("admin.contact.social.platform")}</Label>
                      <Select
                        value={editingLink.platform || link.platform}
                        onValueChange={(value) =>
                          setEditingLink({ ...editingLink, platform: value })
                        }
                      >
                        <SelectTrigger aria-label={t("admin.contact.social.platform")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {socialPlatforms.map((platform) => (
                            <SelectItem
                              key={platform.value}
                              value={platform.value}
                            >
                              {t(platform.label)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("admin.contact.social.url")}</Label>
                      <Input
                        value={
                          editingLink.url !== undefined
                            ? editingLink.url
                            : link.url
                        }
                        onChange={(e) =>
                          setEditingLink({
                            ...editingLink,
                            url: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => {
                          handleUpdate(link.id, editingLink);
                          setEditingLink({ platform: "", url: "" });
                        }}
                        size="sm"
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        {t("admin.contact.social.update")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditingLink({ platform: "", url: "" });
                        }}
                        size="sm"
                      >
                        <X className="h-4 w-4 mr-2" />
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold capitalize">
                          {t(socialPlatforms.find(
                            (p) => p.value === link.platform
                          )?.label || "common.na")}
                        </p>
                        <p className="text-sm text-muted-foreground break-all">
                          {link.url}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingId(link.id);
                            setEditingLink({
                              platform: link.platform,
                              url: link.url,
                            });
                          }}
                        >
                          {t("common.edit")}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(link.id)}
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending && deleteMutation.variables === link.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        title={t("admin.contact.social.title")}
        description={t("admin.contact.social.deleteConfirm")}
        onConfirm={confirmDelete}
        isLoading={deleteMutation.isPending}
      />
    </Card>
  );
}
