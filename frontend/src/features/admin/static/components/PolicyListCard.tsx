import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { CheckCircle, Eye, Loader2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PolicyType } from "@/domains/content";

interface PolicyListCardProps {
  selectedPolicy: PolicyType;
  onSelectedPolicyChange: (val: PolicyType) => void;
  currentPolicy: any;
  onPreview: () => void;
  isRendering: boolean;
}

export const PolicyListCard = ({
  selectedPolicy,
  onSelectedPolicyChange,
  currentPolicy,
  onPreview,
  isRendering,
}: PolicyListCardProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.policies.list.title")}</CardTitle>
        <CardDescription>{t("admin.policies.list.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="view-policy-type">{t("admin.policies.list.viewPolicy")}</Label>
          <Select value={selectedPolicy} onValueChange={onSelectedPolicyChange}>
            <SelectTrigger id="view-policy-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="privacy">{t("admin.policies.types.privacy")}</SelectItem>
              <SelectItem value="terms">{t("admin.policies.types.terms")}</SelectItem>
              <SelectItem value="shipping-refund">{t("admin.policies.types.shippingRefund")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {currentPolicy && !currentPolicy.unavailable ? (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-medium">{t("admin.policies.list.activeVersionFound")}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">{t("admin.policies.list.version")}:</span>
              <span>v{currentPolicy.version}</span>
              <span className="text-muted-foreground">{t("admin.policies.list.lastUpdated")}:</span>
              <span>{new Date(currentPolicy.updatedAt || "").toLocaleDateString()}</span>
              <span className="text-muted-foreground">{t("admin.policies.list.title")}:</span>
              <span>{t(currentPolicy.title)}</span>
            </div>
            <Button variant="outline" onClick={onPreview} className="w-full" disabled={isRendering}>
              {isRendering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              {isRendering ? t("admin.policies.preview.preparing") : "Preview Current Content"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              <span>{t("admin.policies.list.noActivePolicy")}</span>
            </div>
            <p className="text-sm text-muted-foreground">{t("admin.policies.list.uploadInitial")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
