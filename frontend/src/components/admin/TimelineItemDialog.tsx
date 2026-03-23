import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { aboutService } from "@/services/about.service";
import { TimelineItem } from "@/types";
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

interface TimelineItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: TimelineItem | null;
}

export default function TimelineItemDialog({
  open,
  onOpenChange,
  item,
}: TimelineItemDialogProps) {
  const { t } = useTranslation();
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [title_i18n, setTitleI18n] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [description_i18n, setDescriptionI18n] = useState<Record<string, string>>({});
  const [order, setOrder] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (item) {
      setMonth(item.month);
      setYear(item.year);
      setTitle(item.title);
      setTitleI18n(item.title_i18n || {});
      setDescription(item.description);
      setDescriptionI18n(item.description_i18n || {});
      setOrder(item.order);
    } else {
      setMonth("");
      setYear("");
      setTitle("");
      setTitleI18n({});
      setDescription("");
      setDescriptionI18n({});
      setOrder(1);
    }
  }, [item, open]);

  const addMutation = useMutation({
    mutationFn: (newItem: Omit<TimelineItem, "id">) =>
      aboutService.createTimeline(newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteTimeline") });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.deleteTimelineError"),
        description: getErrorMessage(error, t, "admin.about.toasts.deleteTimelineError"),
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
      updates: Partial<Omit<TimelineItem, "id">>;
    }) => aboutService.updateTimeline(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteTimeline") });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!month.trim() || !year.trim() || !title.trim() || !description.trim()) {
      toast({
        title: t("common.error"),
        description: t("auth.fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    const itemData = {
      month: month.trim(),
      year: year.trim(),
      title: title.trim(),
      title_i18n,
      description: description.trim(),
      description_i18n,
      order,
    };

    if (item) {
      updateMutation.mutate({ id: item.id, updates: itemData });
    } else {
      addMutation.mutate(itemData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {item
              ? t("admin.about.dialog.editTitle", { type: t("admin.about.dialog.types.timeline") })
              : t("admin.about.dialog.addTitle", { type: t("admin.about.dialog.types.timeline") })}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Timeline Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">{t("admin.about.dialog.types.timeline")}</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="month">
                    {t("admin.about.dialog.timeline.month")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    placeholder={t("admin.about.dialog.timeline.monthPlaceholder")}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">
                    {t("admin.about.dialog.timeline.year")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="year"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder={t("admin.about.dialog.timeline.yearPlaceholder")}
                    required
                  />
                </div>
              </div>

              <I18nInput
                label={t("admin.about.dialog.timeline.title")}
                value={title}
                i18nValue={title_i18n}
                onChange={(val, i18n) => {
                  setTitle(val);
                  setTitleI18n(i18n);
                }}
                placeholder={t("admin.about.dialog.timeline.titlePlaceholder")}
                required
              />

              <I18nInput
                label={t("admin.about.dialog.timeline.desc")}
                type="textarea"
                value={description}
                i18nValue={description_i18n}
                onChange={(val, i18n) => {
                  setDescription(val);
                  setDescriptionI18n(i18n);
                }}
                placeholder={t("admin.about.dialog.timeline.descPlaceholder")}
                rows={3}
                required
              />
            </div>

            {/* Display Settings */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">{t("admin.about.dialog.displaySettings")}</h3>

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
                {item ? t("common.update") : t("common.add")} {t("admin.about.dialog.types.timeline")}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
