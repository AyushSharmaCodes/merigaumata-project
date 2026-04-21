import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { aboutService } from "@/services/about.service";
import { TeamMember } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { I18nInput } from "./I18nInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProfileImageCropper } from "./ProfileImageCropper";

interface TeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: TeamMember | null;
}

export default function TeamMemberDialog({
  open,
  onOpenChange,
  member,
}: TeamMemberDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [name_i18n, setNameI18n] = useState<Record<string, string>>({});
  const [role, setRole] = useState("");
  const [role_i18n, setRoleI18n] = useState<Record<string, string>>({});
  const [bio, setBio] = useState("");
  const [bio_i18n, setBioI18n] = useState<Record<string, string>>({});
  const [image, setImage] = useState<string | File>("");
  const [originalImageUrl, setOriginalImageUrl] = useState<string>("");
  const [order, setOrder] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (member) {
      setName(member.name);
      setNameI18n(member.name_i18n || {});
      setRole(member.role);
      setRoleI18n(member.role_i18n || {});
      setBio(member.bio);
      setBioI18n(member.bio_i18n || {});
      setImage(member.image);
      setOriginalImageUrl(member.image); // Store original URL
      setOrder(member.order);
    } else {
      setName("");
      setNameI18n({});
      setRole("");
      setRoleI18n({});
      setBio("");
      setBioI18n({});
      setImage("");
      setOriginalImageUrl("");
      setOrder(1);
    }
  }, [member, open]);

  const addMutation = useMutation({
    mutationFn: async (newMember: Omit<TeamMember, "id"> & { imageFile?: File }) => {
      const formData = new FormData();
      const { imageFile, ...rest } = newMember;

      formData.append("data", JSON.stringify(rest));
      if (imageFile) {
        formData.append("image", imageFile);
      }

      return aboutService.createTeamMember(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteTeam") });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.deleteTeamError"),
        description: getErrorMessage(error, t, "admin.about.toasts.deleteTeamError"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<TeamMember, "id">> & { imageFile?: File };
    }) => {
      const formData = new FormData();
      const { imageFile, ...rest } = updates;

      formData.append("data", JSON.stringify(rest));
      if (imageFile) {
        formData.append("image", imageFile);
      }

      return aboutService.updateTeamMember(id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteTeam") });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !role.trim() || !bio.trim() || !image) {
      toast({
        title: t("common.error"),
        description: t("auth.fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    // Determine if we have a new file or should use existing URL
    const imageFile = image instanceof File ? image : undefined;
    const imageUrl = imageFile ? "" : (typeof image === 'string' ? image : originalImageUrl);

    const memberData = {
      name: name.trim(),
      name_i18n,
      role: role.trim(),
      role_i18n,
      bio: bio.trim(),
      bio_i18n,
      image: imageUrl,
      order,
      imageFile,
    };

    if (member) {
      updateMutation.mutate({ id: member.id, updates: memberData });
    } else {
      addMutation.mutate(memberData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-4xl max-h-[90vh]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {member
              ? t("admin.about.dialog.editTitle", { type: t("admin.about.dialog.types.team") })
              : t("admin.about.dialog.addTitle", { type: t("admin.about.dialog.types.team") })}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Basic Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">{t("admin.about.dialog.types.team")}</h3>

              <I18nInput
                label={t("admin.about.dialog.team.name")}
                value={name}
                i18nValue={name_i18n}
                onChange={(val, i18n) => {
                  setName(val);
                  setNameI18n(i18n);
                }}
                placeholder={t("admin.about.dialog.team.namePlaceholder")}
                required
              />

              <I18nInput
                label={t("admin.about.dialog.team.role")}
                value={role}
                i18nValue={role_i18n}
                onChange={(val, i18n) => {
                  setRole(val);
                  setRoleI18n(i18n);
                }}
                placeholder={t("admin.about.dialog.team.rolePlaceholder")}
                required
              />

              <I18nInput
                label={t("admin.about.dialog.team.bio")}
                type="textarea"
                value={bio}
                i18nValue={bio_i18n}
                onChange={(val, i18n) => {
                  setBio(val);
                  setBioI18n(i18n);
                }}
                placeholder={t("admin.about.dialog.team.bioPlaceholder")}
                rows={3}
                required
              />
            </div>

            {/* Photo & Display */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">
                {t("admin.about.dialog.displaySettings")}
              </h3>

              <div className="space-y-2">
                <Label>
                  {t("admin.about.dialog.team.image")} <span className="text-destructive">*</span>
                </Label>
                <ProfileImageCropper
                  image={image}
                  onChange={(file) => setImage(file)}
                  onClear={() => setImage("")}
                />
                <p className="text-sm text-muted-foreground">
                  {t("admin.about.dialog.team.imageHelp")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="order">{t("admin.about.dialog.displayOrder")}</Label>
                <Input
                  id="order"
                  type="number"
                  min="1"
                  value={order}
                  onChange={(e) => setOrder(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("admin.about.dialog.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={addMutation.isPending || updateMutation.isPending}
              >
                {member ? t("common.update") : t("common.add")} {t("admin.about.dialog.types.team")}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
