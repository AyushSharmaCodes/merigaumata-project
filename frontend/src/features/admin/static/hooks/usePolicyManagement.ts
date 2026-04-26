import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { policyService, PolicyType } from "@/domains/content";
import { toast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { logger } from "@/core/observability/logger";

export const usePolicyManagement = () => {
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
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const { data: currentPolicy } = useQuery({
        queryKey: ["policy", selectedPolicy],
        queryFn: () => policyService.getPublic(selectedPolicy).catch(() => null),
        retry: false,
    });

    const uploadMutation = useMutation({
        mutationFn: async (file: File) => {
            if (!policyType) throw new Error(t("admin.policies.toasts.selectPolicyType"));
            return await policyService.upload(file, policyType);
        },
        onSuccess: async (data: any) => {
            const uploadedPolicyType = policyType as PolicyType;
            toast({ title: t("admin.policies.toasts.uploadSuccess") });
            resetFileInput();
            setPolicyType("");
            setSelectedPolicy(uploadedPolicyType);
            queryClient.invalidateQueries({ queryKey: ["policy", uploadedPolicyType] });

            setIsRendering(true);
            try {
                const allVersions = await policyService.getAllLanguageVersions(uploadedPolicyType);
                setPreviewContent(allVersions.contentHtmlI18n);
                setPreviewTitle(data.title || t("admin.policies.preview.title"));
                setPreviewLastUpdated(allVersions.updatedAt);
            } catch (error) {
                logger.error("Failed to fetch policy language versions after upload", { error });
                setPreviewContent({ en: data.contentHtml || data.content_html, hi: '', ta: '', te: '' });
                setPreviewTitle(data.title || t("admin.policies.preview.title"));
                setPreviewLastUpdated(data.updatedAt);
            } finally {
                setTimeout(() => { setIsRendering(false); setIsPreviewOpen(true); }, 1000);
            }
        },
        onError: (error: any) => toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" }),
    });

    const handlePreview = async () => {
        if (currentPolicy && !currentPolicy.unavailable) {
            setIsRendering(true);
            try {
                const allVersions = await policyService.getAllLanguageVersions(selectedPolicy);
                setPreviewContent(allVersions.contentHtmlI18n);
                setPreviewTitle(currentPolicy.title || t(`admin.policies.types.${selectedPolicy.replace(/-./g, x => x[1].toUpperCase())}`));
                setPreviewLastUpdated(allVersions.updatedAt);
            } catch (error) {
                logger.error("Failed to fetch policy language versions for preview", { error });
                setPreviewContent({ en: currentPolicy.contentHtml || '', hi: '', ta: '', te: '' });
                setPreviewTitle(currentPolicy.title || t(`admin.policies.types.${selectedPolicy.replace(/-./g, x => x[1].toUpperCase())}`));
                setPreviewLastUpdated(currentPolicy.updatedAt);
            } finally {
                setTimeout(() => { setIsRendering(false); setIsPreviewOpen(true); }, 800);
            }
        }
    };

    return {
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
    };
};
