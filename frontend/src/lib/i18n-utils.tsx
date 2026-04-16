import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { TranslatedText } from '@/components/ui/TranslatedText';

/**
 * Renders a complex note that might contain:
 * 1. Simple i18n keys (e.g., 'orderDetail.cancelSuccess')
 * 2. Parameterized i18n keys (e.g., 'common.order.deductionNotice:250.00')
 * 3. Literal English strings (which should be dynamically translated)
 * 4. Hybrid strings separated by ' | ' (e.g., 'key | literal')
 * 
 * @param note The raw note string from the backend
 * @returns A React Node with translated parts
 */
export function useRenderComplexNote() {
    const { t } = useTranslation();

    const renderPart = (part: string, index: number) => {
        const trimmedPart = part.trim();
        if (!trimmedPart) return null;

        // Check if it's a parameterized key like "key:value"
        if (trimmedPart.includes(':') && !trimmedPart.includes('://')) {
            const [key, value] = trimmedPart.split(':');
            const trimmedKey = key.trim();
            const trimmedValue = value.trim();

            const translated = t(trimmedKey, { amount: trimmedValue });
            
            // If translation happened (i.e., key exists), return it
            if (translated !== trimmedKey) {
                return <span key={index}>{translated}</span>;
            }
        }

        // Check if it's a simple i18n key
        const translated = t(trimmedPart);
        if (translated !== trimmedPart) {
            return <span key={index}>{translated}</span>;
        }

        // If it's not a key, treat as literal text and use TranslatedText for dynamic translation
        return <TranslatedText key={index} text={trimmedPart} />;
    };

    const renderNote = (note: string | null | undefined) => {
        if (!note) return null;

        const parts = note.split(' | ');
        if (parts.length === 1) {
            return renderPart(parts[0], 0);
        }

        return (
            <span className="inline-flex flex-wrap items-center gap-1">
                {parts.map((part, i) => (
                    <React.Fragment key={i}>
                        {renderPart(part, i)}
                        {i < parts.length - 1 && <span className="mx-0.5 opacity-50">|</span>}
                    </React.Fragment>
                ))}
            </span>
        );
    };

    return { renderNote };
}
