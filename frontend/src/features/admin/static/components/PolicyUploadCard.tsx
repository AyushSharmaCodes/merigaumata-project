import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Upload, FileText, Loader2, FileUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PolicyType } from "@/domains/content";

interface PolicyUploadCardProps {
  policyType: PolicyType | "";
  onPolicyTypeChange: (val: PolicyType) => void;
  selectedFile: File | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const PolicyUploadCard = ({
  policyType,
  onPolicyTypeChange,
  selectedFile,
  onFileChange,
  onUpload,
  isUploading,
  fileInputRef,
}: PolicyUploadCardProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.policies.upload.title")}</CardTitle>
        <CardDescription>{t("admin.policies.upload.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="policy-type">{t("admin.policies.upload.type")}</Label>
          <Select value={policyType} onValueChange={onPolicyTypeChange}>
            <SelectTrigger id="policy-type"><SelectValue placeholder={t("admin.policies.upload.selectType")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="privacy">{t("admin.policies.types.privacy")}</SelectItem>
              <SelectItem value="terms">{t("admin.policies.types.terms")}</SelectItem>
              <SelectItem value="shipping-refund">{t("admin.policies.types.shippingRefund")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="policy-file-upload">{t("admin.policies.upload.file")}</Label>
          <div className="flex items-center justify-center w-full">
            <label htmlFor="policy-file-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground"><span className="font-semibold">{t("admin.policies.upload.clickToUpload")}</span> {t("admin.policies.upload.dragAndDrop")}</p>
                <p className="text-xs text-muted-foreground">{t("admin.policies.upload.fileTypes")}</p>
              </div>
              <input id="policy-file-upload" name="policyFile" ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={onFileChange} />
            </label>
          </div>
          {selectedFile && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-2 rounded">
              <FileText className="w-4 h-4" />
              <span className="truncate">{selectedFile.name}</span>
            </div>
          )}
        </div>

        <Button onClick={onUpload} className="w-full" disabled={!selectedFile || !policyType || isUploading}>
          {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("admin.policies.upload.uploading")}</> : <><FileUp className="mr-2 h-4 w-4" />{t("admin.policies.upload.button")}</>}
        </Button>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-xs font-semibold text-blue-900 mb-1">{t('admin.policies.upload.formatHelp.title')}</p>
          <p className="text-xs text-blue-700 leading-relaxed">{t('admin.policies.upload.formatHelp.description')}</p>
        </div>
      </CardContent>
    </Card>
  );
};
