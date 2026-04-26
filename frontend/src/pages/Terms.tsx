import { PolicyViewer } from "@/features/static";
import { useTranslation } from "react-i18next";

export default function Terms() {
  const { t } = useTranslation();
  return (
    <PolicyViewer
      type="terms"
      fallbackContent={
        <div className="text-center py-10">
          <h1 className="text-3xl font-bold mb-4">{t("policy.termsTitle")}</h1>
          <p className="text-muted-foreground">{t("policy.termsFallback")}</p>
        </div>
      }
    />
  );
}
