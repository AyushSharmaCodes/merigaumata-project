import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, CheckCircle, AlertCircle, Eye, FileUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { policyService, PolicyType } from "@/services/policy.service";
import { PolicyPreviewDialog } from "@/components/admin/PolicyPreviewDialog";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/errorUtils";
import { logger } from "@/lib/logger";

export default function PolicyManagement() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [selectedPolicy, setSelectedPolicy] = useState<PolicyType>("privacy");
    const [policyType, setPolicyType] = useState<PolicyType | "">("");
    const [previewContent, setPreviewContent] = useState<{ en: string; hi: string; ta: string; te: string } | null>(null);
    const [previewTitle, setPreviewTitle] = useState<string>("");
    const [previewLastUpdated, setPreviewLastUpdated] = useState<string | undefined>(undefined);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetFileInput = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Fetch current policy version for the selected type
    const { data: currentPolicy, refetch } = useQuery({
        queryKey: ["policy", selectedPolicy],
        queryFn: async () => {
            try {
                return await policyService.getPublic(selectedPolicy);
            } catch (error) {
                return null;
            }
        },
        retry: false,
    });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            if (!policyType) throw new Error(t("admin.policies.toasts.selectPolicyType"));
            return await policyService.upload(file, policyType);
        },
        onSuccess: async (data: any) => {
            const uploadedPolicyType = policyType;
            toast({ title: t("admin.policies.toasts.uploadSuccess") });

            resetFileInput();
            setPolicyType("");
            setSelectedPolicy(uploadedPolicyType);

            queryClient.invalidateQueries({ queryKey: ["policy", uploadedPolicyType] });

            // Fetch all language versions for preview
            setIsRendering(true);
            try {
                const allVersions = await policyService.getAllLanguageVersions(uploadedPolicyType);
                setPreviewContent(allVersions.contentHtmlI18n);
                setPreviewTitle(data.title || t("admin.policies.preview.title"));
                setPreviewLastUpdated(allVersions.updatedAt);

                setTimeout(() => {
                    setIsRendering(false);
                    setIsPreviewOpen(true);
                }, 1000);
            } catch (error) {
                logger.error("Failed to fetch policy language versions after upload", { error, policyType: uploadedPolicyType });
                // Fallback to single content
                setPreviewContent({ en: data.contentHtml || data.content_html, hi: '', ta: '', te: '' });
                setPreviewTitle(data.title || t("admin.policies.preview.title"));
                setPreviewLastUpdated(data.updatedAt);
                setTimeout(() => {
                    setIsRendering(false);
                    setIsPreviewOpen(true);
                }, 1000);
            }
        },
        onError: (error: any) => {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.policies.toasts.uploadFailed"),
                variant: "destructive",
            });
        },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const validTypes = [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ];

            if (!validTypes.includes(file.type)) {
                toast({
                    title: t("common.error"),
                    description: t("admin.policies.toasts.invalidFileType"),
                    variant: "destructive",
                });
                return;
            }

            setSelectedFile(file);
        }
    };

    const handleUpload = () => {
        if (!selectedFile || !policyType) return;
        uploadMutation.mutate(selectedFile);
    };

    const handlePreview = async () => {
        if (currentPolicy) {
            setIsRendering(true);
            try {
                const allVersions = await policyService.getAllLanguageVersions(selectedPolicy);
                setPreviewContent(allVersions.contentHtmlI18n);
                setPreviewTitle(currentPolicy.title);
                setPreviewLastUpdated(allVersions.updatedAt);
                setTimeout(() => {
                    setIsRendering(false);
                    setIsPreviewOpen(true);
                }, 800);
            } catch (error) {
                logger.error("Failed to fetch policy language versions for preview", { error, policyType: selectedPolicy });
                // Fallback to single content
                setPreviewContent({ en: currentPolicy.contentHtml, hi: '', ta: '', te: '' });
                setPreviewTitle(currentPolicy.title);
                setPreviewLastUpdated(currentPolicy.updatedAt);
                setTimeout(() => {
                    setIsRendering(false);
                    setIsPreviewOpen(true);
                }, 800);
            }
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            <LoadingOverlay isLoading={isRendering} message={t("admin.policies.preview.preparing")} />
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t("admin.policies.title")}</h1>
                <p className="text-muted-foreground">
                    {t("admin.policies.subtitle")}
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>{t("admin.policies.upload.title")}</CardTitle>
                        <CardDescription>
                            {t("admin.policies.upload.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="policy-type">{t("admin.policies.upload.type")}</Label>
                            <Select
                                value={policyType}
                                onValueChange={(value: PolicyType) => {
                                    setPolicyType(value);
                                    resetFileInput();
                                }}
                            >
                                <SelectTrigger id="policy-type">
                                    <SelectValue placeholder={t("admin.policies.upload.selectType")} />
                                </SelectTrigger>
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
                                        <p className="text-sm text-muted-foreground">
                                            <span className="font-semibold">{t("admin.policies.upload.clickToUpload")}</span> {t("admin.policies.upload.dragAndDrop")}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {t("admin.policies.upload.fileTypes")}
                                        </p>
                                    </div>
                                    <input
                                        id="policy-file-upload"
                                        name="policyFile"
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                        onChange={handleFileChange}
                                    />
                                </label>
                            </div>
                            {selectedFile && (
                                <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 p-2 rounded">
                                    <FileText className="w-4 h-4" />
                                    <span className="truncate">{selectedFile.name}</span>
                                </div>
                            )}
                        </div>

                        <Button
                            onClick={handleUpload}
                            className="w-full"
                            disabled={!selectedFile || !policyType || uploadMutation.isPending}
                        >
                            {uploadMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t("admin.policies.upload.uploading")}
                                </>
                            ) : (
                                <>
                                    <FileUp className="mr-2 h-4 w-4" />
                                    {t("admin.policies.upload.button")}
                                </>
                            )}
                        </Button>

                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                            <p className="text-xs font-semibold text-blue-900 mb-1">
                                {t('admin.policies.upload.formatHelp.title', { defaultValue: 'Multi-Language Format' })}
                            </p>
                            <p className="text-xs text-blue-700 leading-relaxed">
                                {t('admin.policies.upload.formatHelp.description', {
                                    defaultValue: 'Upload a single file with sections for all languages. Use markers like === ENGLISH ===, === हिंदी ===, === தமிழ் ===, === తెలుగు === to separate content.'
                                })}
                            </p>
                        </div>

                        <div className="mt-4 text-xs text-muted-foreground">
                            <p>{t("admin.policies.upload.note")}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t("admin.policies.list.title")}</CardTitle>
                        <CardDescription>
                            {t("admin.policies.list.description")}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="view-policy-type">{t("admin.policies.list.viewPolicy")}</Label>
                            <Select
                                value={selectedPolicy}
                                onValueChange={(value: PolicyType) => {
                                    setSelectedPolicy(value);
                                    setPreviewContent(null);
                                }}
                            >
                                <SelectTrigger id="view-policy-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="privacy">{t("admin.policies.types.privacy")}</SelectItem>
                                    <SelectItem value="terms">{t("admin.policies.types.terms")}</SelectItem>
                                    <SelectItem value="shipping-refund">{t("admin.policies.types.shippingRefund")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {currentPolicy ? (
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
                                <Button variant="outline" onClick={handlePreview} className="w-full">
                                    <Eye className="w-4 h-4 mr-2" />
                                    Preview Current Content
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
            </div>

            <PolicyPreviewDialog
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
                title={previewTitle || currentPolicy?.title || t("admin.policies.preview.title")}
                allLanguageContent={previewContent}
                lastUpdated={previewLastUpdated || currentPolicy?.updatedAt}
            />
        </div >
    );
}
