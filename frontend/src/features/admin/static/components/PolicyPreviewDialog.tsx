import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/shared/components/ui/dialog";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Badge } from "@/shared/components/ui/badge";
import DOMPurify from "dompurify";
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from "lucide-react";

interface PolicyPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    contentHtml?: string | null;
    allLanguageContent?: {
        en: string;
        hi: string;
        ta: string;
        te: string;
    } | null;
    lastUpdated?: string;
}

export function PolicyPreviewDialog({
    open,
    onOpenChange,
    title,
    contentHtml,
    allLanguageContent,
    lastUpdated
}: PolicyPreviewDialogProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'en' | 'hi' | 'ta' | 'te'>('en');

    // If allLanguageContent is provided, use it; otherwise fall back to single contentHtml
    const showMultiLanguage = !!allLanguageContent;
    const content = showMultiLanguage
        ? allLanguageContent
        : { en: contentHtml || '', hi: '', ta: '', te: '' };

    // Check which languages have content
    const hasContent = {
        en: !!content.en,
        hi: !!content.hi,
        ta: !!content.ta,
        te: !!content.te
    };

    const languageLabels = {
        en: t('admin.policies.preview.languageTab.en', { defaultValue: 'English' }),
        hi: t('admin.policies.preview.languageTab.hi', { defaultValue: 'हिंदी' }),
        ta: t('admin.policies.preview.languageTab.ta', { defaultValue: 'தமிழ்' }),
        te: t('admin.policies.preview.languageTab.te', { defaultValue: 'తెలుగు' })
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 bg-white overflow-hidden rounded-xl border-none shadow-2xl">
                <DialogHeader className="p-6 pb-4 border-b">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1 flex-1">
                            <DialogTitle className="text-2xl font-bold font-playfair text-[#2C1810]">
                                {title}
                            </DialogTitle>
                            {lastUpdated && (
                                <DialogDescription className="text-sm text-muted-foreground">
                                    Last Updated: {new Date(lastUpdated).toLocaleDateString(undefined, {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </DialogDescription>
                            )}
                        </div>
                        {showMultiLanguage && (
                            <div className="flex gap-2 ml-4">
                                {Object.entries(hasContent).map(([lang, available]) => (
                                    <Badge
                                        key={lang}
                                        variant={available ? "default" : "secondary"}
                                        className="gap-1"
                                    >
                                        {lang.toUpperCase()}
                                        {available ? (
                                            <CheckCircle2 className="w-3 h-3" />
                                        ) : (
                                            <XCircle className="w-3 h-3" />
                                        )}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogHeader>

                {showMultiLanguage ? (
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
                        <div className="px-6 pt-4 border-b">
                            <TabsList className="grid w-full grid-cols-4">
                                {(['en', 'hi', 'ta', 'te'] as const).map((lang) => (
                                    <TabsTrigger key={lang} value={lang} disabled={!hasContent[lang]}>
                                        {languageLabels[lang]}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1 p-8 md:p-12 min-h-0">
                            {(['en', 'hi', 'ta', 'te'] as const).map((lang) => (
                                <TabsContent key={lang} value={lang} className="mt-0">
                                    {hasContent[lang] ? (
                                        <article
                                            className="
                                                prose prose-slate
                                                max-w-none
                                                prose-base
                                                md:prose-lg
                                                dark:prose-invert
                                                prose-headings:font-playfair
                                                prose-headings:font-bold
                                                prose-headings:text-[#1A1A1A]
                                                prose-headings:tracking-tight
                                                prose-p:text-[#4A4A4A]
                                                prose-p:leading-[1.8]
                                                prose-li:text-[#4A4A4A]
                                                prose-li:leading-[1.8]
                                                prose-strong:text-[#1A1A1A]
                                                prose-strong:font-bold
                                                prose-a:text-[#B85C3C]
                                                prose-a:no-underline
                                                hover:prose-a:underline
                                                prose-ul:list-none
                                                prose-ol:list-decimal
                                                [&_ul]:list-none
                                                [&_ol]:list-decimal
                                                [&_ul]:pl-0
                                                [&_li]:relative
                                                [&_ul>li]:pl-7
                                                [&_ul>li]:mb-2
                                                [&_ul>li::before]:content-['']
                                                [&_ul>li::before]:absolute
                                                [&_ul>li::before]:left-0
                                                [&_ul>li::before]:top-[0.7em]
                                                [&_ul>li::before]:w-2
                                                [&_ul>li::before]:h-2
                                                [&_ul>li::before]:bg-[#B85C3C]
                                                [&_ul>li::before]:rounded-full
                                            "
                                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content[lang] || '') }}
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                                            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
                                                <XCircle className="w-8 h-8 text-amber-500" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-lg font-medium text-amber-900">
                                                    {t('admin.policies.preview.notAvailableTitle', { defaultValue: 'Content Missing' })}
                                                </p>
                                                <p className="text-sm text-amber-700/70 max-w-[250px]">
                                                    {t('admin.policies.preview.notAvailable', { defaultValue: 'This policy content has not been provided in this language yet.' })}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>
                            ))}
                        </ScrollArea>
                    </Tabs>
                ) : (
                    <ScrollArea className="flex-1 p-8 md:p-12 min-h-0">
                        <article
                            className="
                                prose prose-slate
                                max-w-none
                                prose-base
                                md:prose-lg
                                dark:prose-invert
                                prose-headings:font-playfair
                                prose-headings:font-bold
                                prose-headings:text-[#1A1A1A]
                                prose-headings:tracking-tight
                                prose-p:text-[#4A4A4A]
                                prose-p:leading-[1.8]
                                prose-li:text-[#4A4A4A]
                                prose-li:leading-[1.8]
                                prose-strong:text-[#1A1A1A]
                                prose-strong:font-bold
                                prose-a:text-[#B85C3C]
                                prose-a:no-underline
                                hover:prose-a:underline
                                prose-ul:list-none
                                prose-ol:list-decimal
                                [&_ul]:list-none
                                [&_ol]:list-decimal
                                [&_ul]:pl-0
                                [&_li]:relative
                                [&_ul>li]:pl-7
                                [&_ul>li]:mb-2
                                [&_ul>li::before]:content-['']
                                [&_ul>li::before]:absolute
                                [&_ul>li::before]:left-0
                                [&_ul>li::before]:top-[0.7em]
                                [&_ul>li::before]:w-2
                                [&_ul>li::before]:h-2
                                [&_ul>li::before]:bg-[#B85C3C]
                                [&_ul>li::before]:rounded-full
                            "
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(contentHtml || `<p class='text-muted-foreground italic'>${t('admin.policy.noContentPreview')}</p>`) }}
                        />
                    </ScrollArea>
                )}

                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('admin.policy.closePreview', { defaultValue: 'Close Preview' })}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
