import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Label } from "@/shared/components/ui/label";
import { useTranslation } from "react-i18next";
import { I18nInput } from "@/features/admin";

interface FooterTabProps {
  footerDescription: string;
  footerDescriptionI18n: Record<string, string>;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDescriptionChange: (value: string) => void;
  onI18nChange: (value: Record<string, string>) => void;
}

export const FooterTab = ({
  footerDescription,
  footerDescriptionI18n,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDescriptionChange,
  onI18nChange,
}: FooterTabProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("admin.about.footer.title")}</CardTitle>
          {!isEditing && (
            <Button size="sm" onClick={onEdit}>
              {t("common.edit")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("admin.about.footer.description")}</Label>
            {isEditing ? (
              <div className="space-y-4">
                <Textarea
                  value={footerDescription}
                  onChange={(e) => onDescriptionChange(e.target.value)}
                  rows={4}
                />
                <div className="space-y-2">
                  <Label>{t("admin.about.footer.descriptionI18n")}</Label>
                  <I18nInput
                    value={footerDescriptionI18n}
                    onChange={onI18nChange}
                    label={t("admin.about.footer.description")}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={onCancel}>
                    {t("common.cancel")}
                  </Button>
                  <Button onClick={onSave}>{t("common.save")}</Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground whitespace-pre-wrap">
                {footerDescription || t("admin.about.footer.noDescription")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
