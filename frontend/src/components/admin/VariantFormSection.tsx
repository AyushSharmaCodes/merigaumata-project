import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, GripVertical, ImageIcon, Check, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { VariantFormData, VariantUnit } from "@/types";
import { I18nInput } from "@/components/admin/I18nInput";

interface VariantFormSectionProps {
    variants: VariantFormData[];
    onChange: (variants: VariantFormData[]) => void;
    disabled?: boolean;
    mode?: "UNIT" | "SIZE";
    onVariantImageRemoved?: (url: string) => void;
}

const GST_RATES = [0, 5, 12, 18, 28];

const createEmptyVariant = (mode: "UNIT" | "SIZE" = "UNIT"): VariantFormData => ({
    size_label: mode === "SIZE" ? "Small" : "",
    size_label_i18n: mode === "SIZE" ? { en: "Small" } : {},
    size_value: 1,
    unit: "kg",
    description: "",
    description_i18n: {},
    mrp: 0,
    selling_price: 0,
    stock_quantity: 0,
    is_default: false,
    hsn_code: "",
    gst_rate: 0,
    tax_applicable: true,
    price_includes_tax: true,
});

export function VariantFormSection({
    variants,
    onChange,
    disabled = false,
    mode = "UNIT",
    onVariantImageRemoved,
}: VariantFormSectionProps) {
    const { t } = useTranslation();
    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const UNIT_OPTIONS: { value: VariantUnit; label: string }[] = [
        { value: "kg", label: t("admin.variants.units.kg") },
        { value: "gm", label: t("admin.variants.units.gm") },
        { value: "ltr", label: t("admin.variants.units.ltr") },
        { value: "ml", label: t("admin.variants.units.ml") },
        { value: "pcs", label: t("admin.variants.units.pcs") },
    ];

    const SIZE_PRESETS: { value: number; unit: VariantUnit; label: string }[] = [
        { value: 0.25, unit: "kg", label: "250 GM" },
        { value: 0.5, unit: "kg", label: "500 GM" },
        { value: 1, unit: "kg", label: "1 KG" },
        { value: 2, unit: "kg", label: "2 KG" },
        { value: 3, unit: "kg", label: "3 KG" },
        { value: 5, unit: "kg", label: "5 KG" },
    ];

    const SIZE_LABELS_PRESETS = [
        t("admin.variants.presets.small"),
        t("admin.variants.presets.medium"),
        t("admin.variants.presets.large"),
        "XL",
        "XXL",
        t("admin.variants.presets.pack2"),
        t("admin.variants.presets.pack5")
    ];

    const handleAddVariant = () => {
        const newVariant = createEmptyVariant(mode);
        if (variants.length === 0) {
            newVariant.is_default = true;
        }
        const updated = [...variants, newVariant];
        onChange(updated);
    };

    const handleRemoveVariant = (index: number) => {
        const updated = variants.filter((_, i) => i !== index);
        if (variants[index].is_default && updated.length > 0) {
            updated[0].is_default = true;
        }
        onChange(updated);
    };

    const handleVariantChange = (
        index: number,
        field: keyof VariantFormData,
        value: string | number | boolean | File | null
    ) => {
        const updated = [...variants];
        updated[index] = { ...updated[index], [field]: value };

        if (mode === 'UNIT' && (field === "size_value" || field === "unit")) {
            const sizeValue = field === "size_value" ? value : updated[index].size_value;
            const unit = field === "unit" ? value : updated[index].unit;
            const formattedLabel = formatSizeLabel(Number(sizeValue), unit as VariantUnit);
            updated[index].size_label = formattedLabel;
            updated[index].size_label_i18n = { ...updated[index].size_label_i18n, en: formattedLabel };
        }

        onChange(updated);
    };

    const handleImageUpload = (index: number, file: File) => {
        const updated = [...variants];
        updated[index] = { ...updated[index], imageFile: file };
        onChange(updated);
    };

    const handleRemoveImage = (index: number) => {
        const updated = [...variants];
        const removedUrl = updated[index].variant_image_url;

        updated[index] = {
            ...updated[index],
            imageFile: undefined,
            variant_image_url: null
        };

        onChange(updated);

        if (removedUrl && typeof removedUrl === 'string' && !removedUrl.startsWith('blob:') && onVariantImageRemoved) {
            onVariantImageRemoved(removedUrl);
        }
    };

    const handleSetDefault = (index: number) => {
        const updated = variants.map((v, i) => ({
            ...v,
            is_default: i === index,
        }));
        onChange(updated);
    };

    const handlePresetSelect = (index: number, preset: typeof SIZE_PRESETS[0]) => {
        const updated = [...variants];
        updated[index] = {
            ...updated[index],
            size_value: preset.value,
            unit: preset.unit,
            size_label: preset.label,
            size_label_i18n: { ...updated[index].size_label_i18n, en: preset.label }
        };
        onChange(updated);
    };

    const formatSizeLabel = (value: number, unit: VariantUnit): string => {
        if (unit === "kg" && value < 1) {
            return `${value * 1000} GM`;
        }
        if (unit === "ltr" && value < 1) {
            return `${value * 1000} ML`;
        }
        return `${value} ${unit.toUpperCase()}`;
    };

    const getDiscountPercent = (mrp: number, sellingPrice: number): number => {
        if (mrp <= 0 || sellingPrice >= mrp) return 0;
        return Math.round(((mrp - sellingPrice) / mrp) * 100);
    };

    const isPriceValid = (variant: VariantFormData): boolean => {
        return variant.selling_price <= variant.mrp;
    };

    const [, setUrlTrigger] = useState(0);
    const activeUrlsRef = useRef<Map<File, string>>(new Map());

    useEffect(() => {
        const filesInUse = new Set<File>();
        let changed = false;

        variants.forEach(v => {
            if (v.imageFile instanceof File) {
                filesInUse.add(v.imageFile);
                if (!activeUrlsRef.current.has(v.imageFile)) {
                    const url = URL.createObjectURL(v.imageFile);
                    activeUrlsRef.current.set(v.imageFile, url);
                    changed = true;
                }
            }
        });

        for (const [file, url] of activeUrlsRef.current.entries()) {
            if (!filesInUse.has(file)) {
                URL.revokeObjectURL(url);
                activeUrlsRef.current.delete(file);
                changed = true;
            }
        }

        if (changed) {
            setUrlTrigger(prev => prev + 1);
        }

    }, [variants]);

    useEffect(() => {
        return () => {
            for (const url of activeUrlsRef.current.values()) {
                URL.revokeObjectURL(url);
            }
            activeUrlsRef.current.clear();
        };
    }, []);

    const getImagePreview = (variant: VariantFormData): string | null => {
        if (variant.imageFile instanceof File) {
            return activeUrlsRef.current.get(variant.imageFile) || null;
        }
        if (variant.variant_image_url) {
            return variant.variant_image_url;
        }
        return null;
    };

    return (
        <div className="space-y-4">
            {variants.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                    <ImageIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground mb-4">
                        {t("admin.products.variants.noVariants")}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleAddVariant}
                        disabled={disabled}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        {t("admin.products.variants.addFirst")}
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {variants.map((variant, index) => {
                        const imagePreview = getImagePreview(variant);

                        return (
                            <Card
                                key={index}
                                className={cn(
                                    "transition-all duration-200",
                                    variant.is_default && "ring-2 ring-primary/50 bg-primary/5",
                                    !isPriceValid(variant) && "ring-2 ring-destructive/50"
                                )}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3 mb-4">
                                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

                                        <div className="flex-1 flex items-center gap-2">
                                            <span className="font-medium">
                                                {variant.size_label || `${t("common.variant")} ${index + 1}`}
                                            </span>
                                            {variant.is_default && (
                                                <Badge variant="default" className="text-xs">
                                                    {t("admin.products.variants.default")}
                                                </Badge>
                                            )}
                                            {!isPriceValid(variant) && (
                                                <Badge variant="destructive" className="text-xs">
                                                    {t("admin.products.variants.priceError")}
                                                </Badge>
                                            )}
                                            {getDiscountPercent(variant.mrp, variant.selling_price) > 0 && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {getDiscountPercent(variant.mrp, variant.selling_price)}% {t("admin.products.variants.off")}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {!variant.is_default && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleSetDefault(index)}
                                                    disabled={disabled}
                                                    className="text-xs"
                                                >
                                                    <Check className="h-3 w-3 mr-1" />
                                                    {t("admin.products.variants.setDefault")}
                                                </Button>
                                            )}
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveVariant(index)}
                                                disabled={disabled || variants.length === 1}
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {mode === "UNIT" ? (
                                        <>
                                            <div className="mb-4">
                                                <Label className="text-xs text-muted-foreground mb-2 block">
                                                    {t("admin.products.variants.quickSizeSelect")}
                                                </Label>
                                                <div className="flex flex-wrap gap-2">
                                                    {SIZE_PRESETS.map((preset) => (
                                                        <Button
                                                            key={preset.label}
                                                            type="button"
                                                            variant={
                                                                variant.size_label === preset.label
                                                                    ? "default"
                                                                    : "outline"
                                                            }
                                                            size="sm"
                                                            onClick={() => handlePresetSelect(index, preset)}
                                                            disabled={disabled}
                                                            className="text-xs h-7"
                                                        >
                                                            {preset.label}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="space-y-1">
                                                    <Label htmlFor={`variant-size-${index}`} className="text-xs">
                                                        {t("admin.products.variants.sizeValue")}
                                                    </Label>
                                                    <Input
                                                        id={`variant-size-${index}`}
                                                        type="number"
                                                        min="0.01"
                                                        step="0.01"
                                                        value={variant.size_value}
                                                        onChange={(e) =>
                                                            handleVariantChange(
                                                                index,
                                                                "size_value",
                                                                parseFloat(e.target.value) || 0
                                                            )
                                                        }
                                                        disabled={disabled}
                                                        className="h-9"
                                                    />
                                                </div>

                                                <div className="space-y-1">
                                                    <Label htmlFor={`variant-unit-${index}`} className="text-xs">
                                                        {t("admin.products.variants.unit")}
                                                    </Label>
                                                    <Select
                                                        value={variant.unit}
                                                        onValueChange={(value: VariantUnit) =>
                                                            handleVariantChange(index, "unit", value)
                                                        }
                                                        disabled={disabled}
                                                    >
                                                        <SelectTrigger id={`variant-unit-${index}`} className="h-9">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {UNIT_OPTIONS.map((opt) => (
                                                                <SelectItem key={opt.value} value={opt.value}>
                                                                    {opt.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="space-y-1 md:col-span-2">
                                                    <Label htmlFor={`variant-label-${index}`} className="text-xs">
                                                        {t("admin.products.variants.sizeLabel")}
                                                    </Label>
                                                    <I18nInput
                                                        label={t("admin.products.variants.sizeLabel")}
                                                        value={variant.size_label}
                                                        i18nValue={variant.size_label_i18n || {}}
                                                        onChange={(val, i18nVal) => {
                                                            const updated = [...variants];
                                                            updated[index] = { ...updated[index], size_label: val, size_label_i18n: i18nVal };
                                                            onChange(updated);
                                                        }}
                                                        placeholder={t("admin.products.variants.sizeLabelPlaceholder")}
                                                        className="h-9"
                                                        disabled={disabled}
                                                    />
                                                </div>

                                                <div className="space-y-1 md:col-span-4">
                                                    <Label htmlFor={`variant-desc-${index}`} className="text-xs">
                                                        {t("admin.products.variants.description")}
                                                    </Label>
                                                    <I18nInput
                                                        label={t("admin.products.variants.description")}
                                                        value={variant.description || ''}
                                                        i18nValue={variant.description_i18n || {}}
                                                        onChange={(val, i18nVal) => {
                                                            const updated = [...variants];
                                                            updated[index] = { ...updated[index], description: val, description_i18n: i18nVal };
                                                            onChange(updated);
                                                        }}
                                                        placeholder={t("admin.products.variants.descriptionPlaceholderBullets")}
                                                        rows={3}
                                                        className="min-h-[60px] py-2 resize-y leading-snug"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div className="space-y-1">
                                                <Label htmlFor={`variant-label-${index}`} className="text-xs">
                                                    {t("admin.products.variants.sizeLabel")} (e.g. Small, Medium)
                                                </Label>
                                                <div className="flex gap-2 flex-wrap mb-1">
                                                    {SIZE_LABELS_PRESETS.map((label) => (
                                                        <Badge
                                                            key={label}
                                                            variant={variant.size_label === label ? "default" : "outline"}
                                                            className="cursor-pointer hover:bg-primary/20"
                                                            onClick={() => {
                                                                const updated = [...variants];
                                                                updated[index] = {
                                                                    ...updated[index],
                                                                    size_label: label,
                                                                    size_label_i18n: { ...updated[index].size_label_i18n, en: label }
                                                                };
                                                                onChange(updated);
                                                            }}
                                                        >
                                                            {label}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <I18nInput
                                                    label={t("admin.products.variants.sizeLabel")}
                                                    value={variant.size_label}
                                                    i18nValue={variant.size_label_i18n || {}}
                                                    onChange={(val, i18nVal) => {
                                                        const updated = [...variants];
                                                        updated[index] = { ...updated[index], size_label: val, size_label_i18n: i18nVal };
                                                        onChange(updated);
                                                    }}
                                                    placeholder={t("admin.products.variants.sizeLabelPlaceholder")}
                                                    className="h-9"
                                                    disabled={disabled}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor={`variant-desc-${index}`} className="text-xs">
                                                    {t("admin.products.variants.description")} ({t("common.bulletPointsSupported")})
                                                </Label>
                                                <I18nInput
                                                    label={t("admin.products.variants.description")}
                                                    value={variant.description || ''}
                                                    i18nValue={variant.description_i18n || {}}
                                                    onChange={(val, i18nVal) => {
                                                        const updated = [...variants];
                                                        updated[index] = { ...updated[index], description: val, description_i18n: i18nVal };
                                                        onChange(updated);
                                                    }}
                                                    placeholder={t("admin.products.variants.descriptionPlaceholderBullets")}
                                                    rows={3}
                                                    className="min-h-[60px]"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                        <div className="space-y-1">
                                            <Label htmlFor={`variant-mrp-${index}`} className="text-xs">
                                                {t("admin.products.variants.mrp")} (₹)
                                            </Label>
                                            <Input
                                                id={`variant-mrp-${index}`}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={variant.mrp}
                                                onChange={(e) =>
                                                    handleVariantChange(
                                                        index,
                                                        "mrp",
                                                        parseFloat(e.target.value) || 0
                                                    )
                                                }
                                                disabled={disabled}
                                                className="h-9"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <Label
                                                htmlFor={`variant-price-${index}`}
                                                className={cn(
                                                    "text-xs",
                                                    !isPriceValid(variant) && "text-destructive"
                                                )}
                                            >
                                                {t("admin.products.variants.sellingPrice")} (₹)
                                            </Label>
                                            <Input
                                                id={`variant-price-${index}`}
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={variant.selling_price}
                                                onChange={(e) =>
                                                    handleVariantChange(
                                                        index,
                                                        "selling_price",
                                                        parseFloat(e.target.value) || 0
                                                    )
                                                }
                                                disabled={disabled}
                                                className={cn(
                                                    "h-9",
                                                    !isPriceValid(variant) && "border-destructive"
                                                )}
                                            />
                                            {!isPriceValid(variant) && (
                                                <p className="text-xs text-destructive">{t("admin.products.variants.mrpError")}</p>
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <Label htmlFor={`variant-stock-${index}`} className="text-xs">
                                                {t("admin.products.variants.stock")}
                                            </Label>
                                            <Input
                                                id={`variant-stock-${index}`}
                                                type="number"
                                                min="0"
                                                value={variant.stock_quantity}
                                                onChange={(e) =>
                                                    handleVariantChange(
                                                        index,
                                                        "stock_quantity",
                                                        parseInt(e.target.value) || 0
                                                    )
                                                }
                                                disabled={disabled}
                                                className="h-9"
                                            />
                                        </div>

                                        <div className="space-y-1 md:col-span-1">
                                            <Label className="text-xs">
                                                {t("admin.products.variants.variantImage")}
                                            </Label>
                                            {imagePreview ? (
                                                <div className="relative inline-block">
                                                    <img
                                                        src={imagePreview}
                                                        alt={`Variant ${variant.size_label}`}
                                                        className="h-20 w-20 object-cover rounded-lg border"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute -top-2 -right-2 h-6 w-6"
                                                        onClick={() => handleRemoveImage(index)}
                                                        disabled={disabled}
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div
                                                    className="flex items-center justify-center h-9 w-full border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                                                    onClick={() => fileInputRefs.current[index]?.click()}
                                                    title={t("admin.products.variants.uploadImage")}
                                                >
                                                    <Upload className="h-4 w-4 text-muted-foreground" />
                                                    <input
                                                        ref={el => fileInputRefs.current[index] = el}
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                handleImageUpload(index, file);
                                                            }
                                                        }}
                                                        disabled={disabled}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-dashed">
                                        <Label className="text-xs font-semibold mb-3 block">{t("admin.products.variants.taxInfo")}</Label>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="flex items-center space-x-2 h-9">
                                                <input
                                                    type="checkbox"
                                                    id={`tax-app-${index}`}
                                                    checked={variant.tax_applicable !== false}
                                                    onChange={(e) => handleVariantChange(index, "tax_applicable", e.target.checked)}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                    disabled={disabled}
                                                />
                                                <Label htmlFor={`tax-app-${index}`} className="text-xs font-normal cursor-pointer">
                                                    {t("admin.products.variants.taxApplicable")}
                                                </Label>
                                            </div>

                                            {variant.tax_applicable !== false && (
                                                <>
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`hsn-${index}`} className="text-xs">{t("admin.products.variants.hsnCode")}</Label>
                                                        <Input
                                                            id={`hsn-${index}`}
                                                            value={variant.hsn_code || ''}
                                                            onChange={(e) => handleVariantChange(index, "hsn_code", e.target.value)}
                                                            placeholder="e.g. 1905"
                                                            className="h-8 text-xs"
                                                            disabled={disabled}
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <Label htmlFor={`gst-${index}`} className="text-xs">{t("admin.products.variants.gstRate")}</Label>
                                                        <Select
                                                            value={variant.gst_rate?.toString() || "0"}
                                                            onValueChange={(value) => handleVariantChange(index, "gst_rate", parseFloat(value))}
                                                            disabled={disabled}
                                                        >
                                                            <SelectTrigger id={`gst-${index}`} className="h-8 text-xs">
                                                                <SelectValue placeholder={t("admin.settings.gst.placeholder")} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {GST_RATES.map((rate) => (
                                                                    <SelectItem key={rate} value={rate.toString()}>
                                                                        {rate}%
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <div className="flex items-center space-x-2 h-9 md:col-start-4">
                                                        <input
                                                            type="checkbox"
                                                            id={`inc-tax-${index}`}
                                                            checked={variant.price_includes_tax !== false}
                                                            onChange={(e) => handleVariantChange(index, "price_includes_tax", e.target.checked)}
                                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                            disabled={disabled}
                                                        />
                                                        <Label htmlFor={`inc-tax-${index}`} className="text-xs font-normal cursor-pointer">
                                                            {t("admin.products.variants.priceIncludesTax")}
                                                        </Label>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {variants.length > 0 && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddVariant}
                    disabled={disabled}
                    className="w-full"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("admin.products.variants.addAnother")}
                </Button>
            )}

            {variants.length > 0 && !variants.some((v) => v.is_default) && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                    ⚠️ {t("admin.products.variants.noDefaultWarning")}
                </p>
            )}
        </div>
    );
}
