import { PolicyViewer } from "@/components/PolicyViewer";
import { useTranslation } from "react-i18next";

export default function Privacy() {
  const { t } = useTranslation();
  return (
    <PolicyViewer
      type="privacy"
      fallbackContent={
        <div className="text-center py-10">
          <h1 className="text-3xl font-bold mb-4">{t("policy.privacyTitle")}</h1>
          <p className="text-muted-foreground">{t("policy.privacyFallback")}</p>
        </div>
      }
    />
  );
}
