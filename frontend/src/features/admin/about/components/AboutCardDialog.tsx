import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { aboutService } from "@/domains/content";
import { AboutCard } from "@/shared/types";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { I18nInput } from "@/features/admin";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

interface AboutCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: AboutCard | null;
}

const iconOptions = [
  "Target",
  "Eye",
  "Heart",
  "Flag",
  "Star",
  "Award",
  "TrendingUp",
  "Users",
];

export default function AboutCardDialog({
  open,
  onOpenChange,
  card,
}: AboutCardDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [title_i18n, setTitleI18n] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [description_i18n, setDescriptionI18n] = useState<Record<string, string>>({});
  const [icon, setIcon] = useState("Target");
  const [order, setOrder] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setTitleI18n(card.title_i18n || {});
      setDescription(card.description);
      setDescriptionI18n(card.description_i18n || {});
      setIcon(card.icon);
      setOrder(card.order);
    } else {
      setTitle("");
      setTitleI18n({});
      setDescription("");
      setDescriptionI18n({});
      setIcon("Target");
      setOrder(1);
    }
  }, [card, open]);

  const addMutation = useMutation({
    mutationFn: (newCard: Omit<AboutCard, "id">) =>
      aboutService.createCard(newCard),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteCard") });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.deleteCardError"),
        description: getErrorMessage(error, t, "admin.about.toasts.deleteCardError"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<AboutCard, "id">>;
    }) => aboutService.updateCard(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteCard") });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.deleteCardError"),
        description: getErrorMessage(error, t, "admin.about.toasts.deleteCardError"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      toast({
        title: t("common.error"),
        description: t("auth.fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    const cardData = {
      title: title.trim(),
      title_i18n,
      description: description.trim(),
      description_i18n,
      icon,
      order,
    };

    if (card) {
      updateMutation.mutate({ id: card.id, updates: cardData });
    } else {
      addMutation.mutate(cardData);
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
            {card
              ? t("admin.about.dialog.editTitle", { type: t("admin.about.dialog.types.card") })
              : t("admin.about.dialog.addTitle", { type: t("admin.about.dialog.types.card") })}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Basic Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">{t("admin.about.dialog.types.card")}</h3>

              <I18nInput
                label={t("admin.about.dialog.card.title")}
                value={title}
                i18nValue={title_i18n}
                onChange={(val, i18n) => {
                  setTitle(val);
                  setTitleI18n(i18n);
                }}
                placeholder={t("admin.about.dialog.card.titlePlaceholder")}
                required
              />

              <I18nInput
                label={t("admin.about.dialog.card.desc")}
                type="textarea"
                value={description}
                i18nValue={description_i18n}
                onChange={(val, i18n) => {
                  setDescription(val);
                  setDescriptionI18n(i18n);
                }}
                placeholder={t("admin.about.dialog.card.descPlaceholder")}
                rows={4}
                required
              />
            </div>

            {/* Display Settings */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">{t("admin.about.dialog.displaySettings")}</h3>

              <div className="space-y-2">
                <Label htmlFor="icon">{t("admin.about.dialog.card.icon")}</Label>
                <Select value={icon} onValueChange={setIcon}>
                  <SelectTrigger id="icon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((iconName) => (
                      <SelectItem key={iconName} value={iconName}>
                        {iconName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                {card ? t("common.update") : t("common.add")} {t("admin.about.dialog.types.card")}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog >
  );
}
