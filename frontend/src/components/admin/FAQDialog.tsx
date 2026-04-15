import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
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
import { type FAQWithCategory, faqService } from "@/services/faq.service";
import type { Category } from "@/services/category.service";
import { I18nInput } from "./I18nInput";
import { Loader2 } from "lucide-react";

interface FAQDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (faq: {
    id?: string;
    question: string;
    question_i18n: Record<string, string>;
    answer: string;
    answer_i18n: Record<string, string>;
    category_id: string;
    display_order?: number;
    is_active?: boolean;
  }) => void;
  faq: FAQWithCategory | null;
  categories: Category[];
}

export function FAQDialog({
  open,
  onOpenChange,
  onSave,
  faq,
  categories,
}: FAQDialogProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<{
    question: string;
    question_i18n: Record<string, string>;
    answer: string;
    answer_i18n: Record<string, string>;
    category_id: string;
    is_active: boolean;
  }>({
    question: "",
    question_i18n: {},
    answer: "",
    answer_i18n: {},
    category_id: "",
    is_active: true,
  });

    // Fetch fresh FAQ data when editing
    const { data: detailedFAQ, isLoading: isLoadingFAQ } = useQuery({
        queryKey: ["admin-faq-detail", faq?.id],
        queryFn: () => faqService.getById(faq!.id),
        enabled: !!faq?.id && open,
        staleTime: 0,
    });

    useEffect(() => {
        const source = detailedFAQ || faq;
        if (source) {
            setFormData({
                question: source.question,
                question_i18n: source.question_i18n || {},
                answer: source.answer,
                answer_i18n: source.answer_i18n || {},
                category_id: source.category_id,
                is_active: source.is_active,
            });
        } else {
            setFormData({
                question: "",
                question_i18n: {},
                answer: "",
                answer_i18n: {},
                category_id: categories[0]?.id || "",
                is_active: true,
            });
        }
    }, [faq, detailedFAQ, open, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const faqData = {
      question: formData.question,
      question_i18n: formData.question_i18n,
      answer: formData.answer,
      answer_i18n: formData.answer_i18n,
      category_id: formData.category_id,
      is_active: formData.is_active,
      ...(faq?.id && { id: faq.id }),
    };

    onSave(faqData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {faq ? t("admin.faqs.dialog.editTitle") : t("admin.faqs.dialog.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {faq
              ? t("admin.faqs.dialog.editSubtitle")
              : t("admin.faqs.dialog.addSubtitle")}
          </DialogDescription>
        </DialogHeader>

        {faq && isLoadingFAQ ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-medium">{t("common.loading", { defaultValue: "Loading details..." })}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="overflow-y-auto max-h-[calc(90vh-180px)] pr-4">
            <div className="space-y-6 py-2">
              {/* Category Selection */}
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="text-base font-semibold">{t("admin.faqs.dialog.categoryTitle")}</h3>

                <div className="space-y-2">
                  <Label>
                    {t("admin.faqs.dialog.categoryLabel")} <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category_id: value })
                    }
                  >
                    <SelectTrigger aria-label={t("admin.faqs.dialog.categoryLabel")}>
                      <SelectValue placeholder={t("admin.faqs.dialog.selectCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Question & Answer */}
              <div className="space-y-4 border rounded-lg p-4">
                <h3 className="text-base font-semibold">{t("admin.faqs.dialog.contentTitle")}</h3>

                <I18nInput
                  label={t("admin.faqs.dialog.questionLabel")}
                  value={formData.question}
                  i18nValue={formData.question_i18n}
                  onChange={(val, i18nVal) => setFormData({ ...formData, question: val, question_i18n: i18nVal })}
                  placeholder={t("admin.faqs.dialog.questionPlaceholder")}
                  required
                />

                <I18nInput
                  label={t("admin.faqs.dialog.answerLabel")}
                  type="textarea"
                  value={formData.answer}
                  i18nValue={formData.answer_i18n}
                  onChange={(val, i18nVal) => setFormData({ ...formData, answer: val, answer_i18n: i18nVal })}
                  placeholder={t("admin.faqs.dialog.answerPlaceholder")}
                  rows={8}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t("admin.faqs.dialog.answerHint")}
                </p>
              </div>

              {/* Visibility Settings */}
              <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                <h3 className="text-base font-semibold">{t("admin.faqs.dialog.visibilityTitle")}</h3>

                <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
                  <div className="space-y-0.5">
                    <Label className="text-base">
                      {t("admin.faqs.dialog.activeStatusLabel")}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {formData.is_active
                        ? t("admin.faqs.dialog.visibleHint")
                        : t("admin.faqs.dialog.hiddenHint")}
                    </p>
                  </div>
                  <Switch
                    id="isActive"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("admin.faqs.dialog.cancel")}
            </Button>
            <Button type="submit">{faq ? t("admin.faqs.dialog.updateButton") : t("admin.faqs.dialog.createButton")}</Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
