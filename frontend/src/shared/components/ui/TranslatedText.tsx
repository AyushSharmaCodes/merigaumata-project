import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiClient } from '@/core/api/api-client';
import { logger } from '@/core/observability/logger';
import { Loader2 } from 'lucide-react';

interface TranslatedTextProps {
    text: string;
    className?: string;
}

export function TranslatedText({ text, className = "" }: TranslatedTextProps) {
    const { i18n } = useTranslation();
    const [translated, setTranslated] = useState(text);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const currentLang = i18n.language || 'en';

        // Don't translate if language is English or text is empty
        if (!text || currentLang === 'en') {
            setTranslated(text);
            return;
        }

        const translateText = async () => {
            setLoading(true);
            try {
                // Try from local cache first to prevent spam
                const cacheKey = `trans_${currentLang}_${text}`;
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) {
                    if (isMounted) setTranslated(cached);
                    return;
                }

                const response = await apiClient.post('/translate', {
                    text,
                    targetLang: currentLang
                });

                if (response.data && response.data.translatedText) {
                    sessionStorage.setItem(cacheKey, response.data.translatedText);
                    if (isMounted) {
                        setTranslated(response.data.translatedText);
                    }
                }
            } catch (error) {
                logger.error("Dynamic translation failed", { error, text, language: currentLang });
                if (isMounted) setTranslated(text); // Fallback to original
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        translateText();

        return () => {
            isMounted = false;
        };
    }, [text, i18n.language]);

    return (
        <span className={`inline-flex items-center gap-1 ${className}`}>
            {translated}
            {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </span>
    );
}
