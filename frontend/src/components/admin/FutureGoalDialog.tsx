import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { aboutService } from "@/services/about.service";
import { FutureGoal } from "@/types";
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

interface FutureGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: FutureGoal | null;
}

export default function FutureGoalDialog({
  open,
  onOpenChange,
  goal,
}: FutureGoalDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [title_i18n, setTitleI18n] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [description_i18n, setDescriptionI18n] = useState<Record<string, string>>({});
  const [order, setOrder] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      setTitleI18n(goal.title_i18n || {});
      setDescription(goal.description);
      setDescriptionI18n(goal.description_i18n || {});
      setOrder(goal.order);
    } else {
      setTitle("");
      setTitleI18n({});
      setDescription("");
      setDescriptionI18n({});
      setOrder(1);
    }
  }, [goal, open]);

  const addMutation = useMutation({
    mutationFn: (newGoal: Omit<FutureGoal, "id">) =>
      aboutService.createGoal(newGoal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteGoal") });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.deleteGoalError"),
        description: getErrorMessage(error, t, "admin.about.toasts.deleteGoalError"),
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
      updates: Partial<Omit<FutureGoal, "id">>;
    }) => aboutService.updateGoal(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteGoal") });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.deleteGoalError"),
        description: getErrorMessage(error, t, "admin.about.toasts.deleteGoalError"),
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

    const goalData = {
      title: title.trim(),
      title_i18n,
      description: description.trim(),
      description_i18n,
      order,
    };

    if (goal) {
      updateMutation.mutate({ id: goal.id, updates: goalData });
    } else {
      addMutation.mutate(goalData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {goal
              ? t("admin.about.dialog.editTitle", { type: t("admin.about.dialog.types.goal") })
              : t("admin.about.dialog.addTitle", { type: t("admin.about.dialog.types.goal") })}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Goal Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">{t("admin.about.dialog.types.goal")}</h3>

              <I18nInput
                label={t("admin.about.dialog.goal.title")}
                value={title}
                i18nValue={title_i18n}
                onChange={(val, i18n) => {
                  setTitle(val);
                  setTitleI18n(i18n);
                }}
                placeholder={t("admin.about.dialog.goal.titlePlaceholder")}
                required
              />

              <I18nInput
                label={t("admin.about.dialog.goal.desc")}
                type="textarea"
                value={description}
                i18nValue={description_i18n}
                onChange={(val, i18n) => {
                  setDescription(val);
                  setDescriptionI18n(i18n);
                }}
                placeholder={t("admin.about.dialog.goal.descPlaceholder")}
                rows={4}
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
                {goal ? t("common.update") : t("common.add")} {t("admin.about.dialog.types.goal")}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
