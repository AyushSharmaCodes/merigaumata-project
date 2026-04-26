import * as React from 'react';
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { availableLanguages } from '@/app/i18n/config';
import { RichTextEditor } from '@/features/admin';

interface I18nInputProps {
    label: string;
    type?: 'input' | 'textarea' | 'richtext';
    value: string; // The base (usually English) value
    i18nValue?: Record<string, string>; // The translations object
    onChange: (value: string, i18nValue: Record<string, string>) => void;
    placeholder?: string;
    required?: boolean;
    rows?: number;
    className?: string;
    id?: string;
    disabled?: boolean;
}

/**
 * A reusable component for handling multi-language text input in admin dialogs.
 * It provides tabs to switch between different languages.
 */
export function I18nInput({
    label,
    type = 'input',
    value,
    i18nValue = {},
    onChange,
    placeholder,
    required,
    rows = 4,
    className = "",
    id,
    disabled = false
}: I18nInputProps) {
    // Ensure we have an object for i18nValue
    const safeI18nValue = i18nValue || {};

    const handleLangChange = (lang: string, newValue: string) => {
        const newI18nValue = { ...safeI18nValue, [lang]: newValue };

        // If we are updating English (base), reflect it in the base value too
        if (lang === 'en') {
            onChange(newValue, newI18nValue);
        } else {
            // Otherwise, keep base value as is and update i18n object
            onChange(value, newI18nValue);
        }
    };

    const { i18n } = useTranslation();
    const [activeTab, setActiveTab] = React.useState(i18n.language || "en");

    // Sync active tab with global language if desired, or let user control it
    // Here we initialize with global but allow manual override
    React.useEffect(() => {
        if (availableLanguages.includes(i18n.language)) {
            setActiveTab(i18n.language);
        }
    }, [i18n.language]);

    return (
        <div className={`space-y-2 ${className}`}>
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
            >
                <div className="flex items-center justify-between mb-1.5">
                    <TabsList className="h-8 p-0.5 bg-muted/50">
                        {availableLanguages.map((lang) => (
                            <TabsTrigger
                                key={lang}
                                value={lang}
                                className="h-7 px-3 text-[11px] uppercase font-bold tracking-wider data-[state=active]:bg-background"
                            >
                                {lang}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>

                {availableLanguages.map((lang) => (
                    <TabsContent key={lang} value={lang} className="mt-0 ring-0 focus-visible:ring-0">
                        {type === 'input' ? (
                            <Input
                                name={lang === 'en' ? (id ?? `${label}-input`) : `${id ?? label}-${lang}`}
                                aria-label={`${label} (${lang.toUpperCase()})`}
                                value={lang === 'en' ? (value || "") : (safeI18nValue[lang] || "")}
                                onChange={(e) => handleLangChange(lang, e.target.value)}
                                placeholder={placeholder || `${label} (${lang.toUpperCase()})`}
                                required={required && lang === 'en'}
                                className="focus-visible:ring-1"
                                id={lang === 'en' ? id : undefined}
                                disabled={disabled}
                            />
                        ) : type === 'textarea' ? (
                            <Textarea
                                name={lang === 'en' ? (id ?? `${label}-textarea`) : `${id ?? label}-${lang}`}
                                aria-label={`${label} (${lang.toUpperCase()})`}
                                value={lang === 'en' ? (value || "") : (safeI18nValue[lang] || "")}
                                onChange={(e) => handleLangChange(lang, e.target.value)}
                                placeholder={placeholder || `${label} (${lang.toUpperCase()})`}
                                required={required && lang === 'en'}
                                rows={rows}
                                className="resize-none focus-visible:ring-1"
                                id={lang === 'en' ? id : undefined}
                                disabled={disabled}
                            />
                        ) : (
                            <RichTextEditor
                                content={lang === 'en' ? (value || "") : (safeI18nValue[lang] || "")}
                                onChange={(content) => handleLangChange(lang, content)}
                                placeholder={placeholder || `${label} (${lang.toUpperCase()})`}
                            />
                        )}
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
