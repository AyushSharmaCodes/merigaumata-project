import { memo } from "react";
import { Tag } from "@/shared/components/ui/Tag";
import { Card } from "@/shared/components/ui/card";
import { useTranslation } from "react-i18next";
import { ProductMessages } from "@/shared/constants/messages/ProductMessages";

interface ProductGalleryProps {
    images: string[];
    displayImage: string;
    onImageClick: (image: string, index: number) => void;
    title: string;
    isNew?: boolean;
    discount?: number;
}

export const ProductGallery = memo(({
    images,
    displayImage,
    onImageClick,
    title,
    isNew,
    discount
}: ProductGalleryProps) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <Card className="relative overflow-hidden rounded-[2rem] border-none shadow-xl bg-white aspect-square max-w-xl mx-auto lg:mx-0">
                <img
                    src={displayImage}
                    alt={title}
                    className="w-full h-full object-cover transition-opacity duration-300"
                />

                {isNew && (
                    <div className="absolute top-6 left-6 z-10">
                        <Tag variant="new" size="sm" className="bg-gradient-to-r from-primary to-primary/80 backdrop-blur-md text-primary-foreground border border-white/20 px-4 py-1.5 shadow-xl font-black uppercase tracking-wider text-[9px] animate-in fade-in zoom-in duration-500">
                            {t(ProductMessages.NEW)}
                        </Tag>
                    </div>
                )}

                {discount && discount > 0 && (
                    <div className="absolute top-6 right-6">
                        <Tag variant="discount" size="sm" className="bg-[#D4AF37] text-white border-none px-4 py-1.5 shadow-lg font-black text-[9px]">
                            {t(ProductMessages.OFF, { percent: discount })}
                        </Tag>
                    </div>
                )}
            </Card>

            {images.length > 1 && (
                <div className="flex gap-3 px-1 overflow-x-auto pb-2 no-scrollbar justify-center lg:justify-start">
                    {images.map((image, index) => (
                        <button
                            key={index}
                            onClick={() => onImageClick(image, index)}
                            className={`relative flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden transition-all duration-300 border-2 ${displayImage === image
                                ? "border-[#B85C3C] shadow-md scale-105"
                                : "border-transparent opacity-60 hover:opacity-100"
                                }`}
                        >
                            <img src={image} alt={title} className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});

ProductGallery.displayName = "ProductGallery";
