import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { aboutService } from "@/services/about.service";
import { ImpactStat } from "@/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ImpactStatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stat?: ImpactStat | null;
}

const iconOptions = [
  "TrendingUp",
  "Users",
  "Heart",
  "Award",
  "Star",
  "Target",
  "Shield",
  "Zap",
];

export default function ImpactStatDialog({
  open,
  onOpenChange,
  stat,
}: ImpactStatDialogProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [label_i18n, setLabelI18n] = useState<Record<string, string>>({});
  const [icon, setIcon] = useState("TrendingUp");
  const [order, setOrder] = useState(1);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (stat) {
      setValue(stat.value);
      setLabel(stat.label);
      setLabelI18n(stat.label_i18n || {});
      setIcon(stat.icon);
      setOrder(stat.order);
    } else {
      setValue("");
      setLabel("");
      setLabelI18n({});
      setIcon("TrendingUp");
      setOrder(1);
    }
  }, [stat, open]);

  const createMutation = useMutation({
    mutationFn: (newStat: Omit<ImpactStat, "id">) =>
      aboutService.createStat(newStat),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteStat") });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.deleteStatError"),
        description: getErrorMessage(error, t, "admin.about.toasts.deleteStatError"),
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
      updates: Partial<Omit<ImpactStat, "id">>;
    }) => aboutService.updateStat(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aboutUs"] });
      toast({ title: t("admin.about.toasts.deleteStat") });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast({
        title: t("admin.about.toasts.deleteStatError"),
        description: getErrorMessage(error, t, "admin.about.toasts.deleteStatError"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!value.trim() || !label.trim()) {
      toast({
        title: t("common.error"),
        description: t("auth.fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    const statData = {
      value: value.trim(),
      label: label.trim(),
      label_i18n,
      icon,
      order,
    };

    if (stat) {
      updateMutation.mutate({ id: stat.id, updates: statData });
    } else {
      createMutation.mutate(statData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {stat
              ? t("admin.about.dialog.editTitle", { type: t("admin.about.dialog.types.impact") })
              : t("admin.about.dialog.addTitle", { type: t("admin.about.dialog.types.impact") })}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* Statistic Information */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">{t("admin.about.dialog.types.impact")}</h3>

              <div className="space-y-2">
                <Label htmlFor="value">
                  {t("admin.about.dialog.impact.value")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={t("admin.about.dialog.impact.valuePlaceholder")}
                  required
                />
              </div>

              <I18nInput
                label={t("admin.about.dialog.impact.label")}
                value={label}
                i18nValue={label_i18n}
                onChange={(val, i18n) => {
                  setLabel(val);
                  setLabelI18n(i18n);
                }}
                placeholder={t("admin.about.dialog.impact.labelPlaceholder")}
                required
              />
            </div>

            {/* Display Settings */}
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="text-base font-semibold">{t("admin.about.dialog.displaySettings")}</h3>

              <div className="space-y-2">
                <Label htmlFor="icon">{t("admin.about.dialog.impact.icon")}</Label>
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
                  max="4"
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
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {stat ? t("common.update") : t("common.add")} {t("admin.about.dialog.types.impact")}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
