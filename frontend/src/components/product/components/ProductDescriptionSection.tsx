import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { ProductMessages } from "@/constants/messages/ProductMessages";

interface ProductDescriptionSectionProps {
    description?: string;
    variantDescription?: string;
    sizeLabel?: string;
    variantMode?: string;
    benefits: string[];
}

export const ProductDescriptionSection = memo(({
    description,
    variantDescription,
    sizeLabel,
    variantMode,
    benefits
}: ProductDescriptionSectionProps) => {
    const { t } = useTranslation();

    if (!description && !variantDescription && benefits.length === 0) return null;

    return (
        <div className="space-y-3">
            {description && (
                <div className="space-y-1.5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#2C1810]">{t(ProductMessages.DESCRIPTION)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-light">
                        {description}
                    </p>
                </div>
            )}

            {/* Selected Variant Description */}
            {variantDescription && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-left-1 duration-300">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#2C1810]">
                        {variantMode === 'SIZE'
                            ? t(ProductMessages.SIZE_DETAILS, { size: sizeLabel })
                            : t(ProductMessages.VARIANT_DETAILS)}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-light whitespace-pre-line">
                        {variantDescription}
                    </p>
                </div>
            )}

            {benefits.length > 0 && (
                <div className="space-y-2.5">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#2C1810]">{t(ProductMessages.KEY_BENEFITS)}</h3>
                    <div className="grid grid-cols-1 gap-1.5">
                        {benefits.map((benefit, index) => (
                            <div key={index} className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#B85C3C]" />
                                <span className="text-xs text-muted-foreground font-medium">{benefit}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

ProductDescriptionSection.displayName = "ProductDescriptionSection";
