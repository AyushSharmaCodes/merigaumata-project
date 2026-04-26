import { usePolicyManagement, PolicyUploadCard, PolicyListCard, PolicyPreviewDialog } from "@/features/admin/static";
import { toast } from "@/shared/hooks/use-toast";

export default function PolicyManagement() {
    const {
        t,
        selectedPolicy, setSelectedPolicy,
        policyType, setPolicyType,
        previewContent,
        previewTitle,
        previewLastUpdated,
        selectedFile, setSelectedFile,
        isPreviewOpen, setIsPreviewOpen,
        isRendering,
        fileInputRef,
        currentPolicy,
        uploadMutation,
        handlePreview,
        resetFileInput,
    } = usePolicyManagement();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const validTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
            if (!validTypes.includes(file.type)) {
                toast({ title: t("common.error"), description: t("admin.policies.toasts.invalidFileType"), variant: "destructive" });
                return;
            }
            setSelectedFile(file);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t("admin.policies.title")}</h1>
                <p className="text-muted-foreground">{t("admin.policies.subtitle")}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <PolicyUploadCard
                    policyType={policyType}
                    onPolicyTypeChange={(val) => { setPolicyType(val); resetFileInput(); }}
                    selectedFile={selectedFile}
                    onFileChange={handleFileChange}
                    onUpload={() => selectedFile && uploadMutation.mutate(selectedFile)}
                    isUploading={uploadMutation.isPending}
                    fileInputRef={fileInputRef}
                />

                <PolicyListCard
                    selectedPolicy={selectedPolicy}
                    onSelectedPolicyChange={(val) => setSelectedPolicy(val)}
                    currentPolicy={currentPolicy}
                    onPreview={handlePreview}
                    isRendering={isRendering}
                />
            </div>

            <PolicyPreviewDialog
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
                title={previewTitle || currentPolicy?.title || t("admin.policies.preview.title")}
                allLanguageContent={previewContent}
                lastUpdated={previewLastUpdated || currentPolicy?.updatedAt}
            />
        </div>
    );
}
