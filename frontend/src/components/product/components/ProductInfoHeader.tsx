import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import { ProductMessages } from "@/constants/messages/ProductMessages";
import { AVAILABLE_TAGS } from "@/constants/productConstants";

interface ProductInfoHeaderProps {
    title: string;
    tags: string[];
    rating?: number;
    ratingCount?: number;
    hasRating: boolean;
}

export const ProductInfoHeader = memo(({
    title,
    tags,
    rating,
    ratingCount,
    hasRating
}: ProductInfoHeaderProps) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-2">
            <h1 className="text-3xl lg:text-4xl font-bold text-[#2C1810] font-playfair leading-tight">
                {title}
            </h1>

            {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-[#FAF7F2] border border-[#B85C3C]/10 rounded-md text-[10px] font-bold text-[#B85C3C] uppercase tracking-wider">
                            {AVAILABLE_TAGS.includes(tag.toLowerCase()) ? t(`products.tags.${tag.toLowerCase()}`) : tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Rating Summary - Conditionally shown */}
            {hasRating && (
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-[#D4AF37]/5 px-3 py-1.5 rounded-full border border-[#D4AF37]/20 shadow-sm">
                        <div className="flex items-center gap-1 mr-2.5">
                            {[...Array(5)].map((_, i) => (
                                <Star
                                    key={i}
                                    size={14}
                                    strokeWidth={2}
                                    className={i < Math.floor(rating || 0) ? "fill-[#D4AF37] text-[#D4AF37] drop-shadow-[0_0_3px_rgba(212,175,55,0.2)]" : "text-[#D4AF37]/20"}
                                />
                            ))}
                        </div>
                        <span className="text-sm font-black text-[#2C1810]">{rating}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                        {ratingCount} {t(ProductMessages.RATINGS)}
                    </span>
                </div>
            )}
        </div>
    );
});

ProductInfoHeader.displayName = "ProductInfoHeader";
