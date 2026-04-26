import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { 
    Plus, 
    Trash2, 
    GripVertical, 
    ImageIcon, 
    Check, 
    Upload, 
    X, 
    ChevronDown, 
    ChevronUp, 
    Info, 
    Banknote, 
    Ruler, 
    Package, 
    Settings2,
    ArrowRight
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/core/utils/utils";
import type { DeliveryConfig, VariantFormData, VariantUnit } from "@/shared/types";
import { I18nInput } from "@/features/admin";
import { DeliveryConfigForm } from "@/features/admin/orders";
import { MAX_ADMIN_IMAGE_SIZE_BYTES, MAX_ADMIN_IMAGE_SIZE_MB } from "@/shared/constants/upload.constants";
import { toast } from "@/shared/hooks/use-toast";
import { optimizeImage } from "@/core/utils/image-optimization.utils";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";

interface VariantFormSectionProps {
    variants: VariantFormData[];
    onChange: (variants: VariantFormData[]) => void;
    disabled?: boolean;
    mode?: "UNIT" | "SIZE";
    productId?: string;
    defaultTaxConfig?: {
        default_hsn_code?: string;
        default_gst_rate?: number;
        default_tax_applicable?: boolean;
        default_price_includes_tax?: boolean;
    };
    onVariantImageRemoved?: (url: string) => void;
}

const GST_RATES = [0, 5, 12, 18, 28];

const createEmptyVariant = (
    mode: "UNIT" | "SIZE" = "UNIT",
    defaultTaxConfig: VariantFormSectionProps["defaultTaxConfig"] = {}
): VariantFormData => ({
    size_label: mode === "SIZE" ? "Small" : "",
    size_label_i18n: mode === "SIZE" ? { en: "Small" } : {},
    size_label_manual: mode === "SIZE",
    size_value: 1,
    unit: "kg",
    description: "",
    description_i18n: {},
    mrp: 0,
    selling_price: 0,
    stock_quantity: 0,
    is_default: false,
    hsn_code: defaultTaxConfig?.default_hsn_code || "",
    gst_rate: defaultTaxConfig?.default_gst_rate ?? 0,
    tax_applicable: defaultTaxConfig?.default_tax_applicable ?? true,
    price_includes_tax: defaultTaxConfig?.default_price_includes_tax ?? true,
});

export function VariantFormSection({
    variants,
    onChange,
    disabled = false,
    mode = "UNIT",
    productId = "",
    defaultTaxConfig,
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

    const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set([0]));

    const toggleExpand = (index: number) => {
        setExpandedIndices(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const handleAddVariant = () => {
        const newVariant = createEmptyVariant(mode, defaultTaxConfig);
        if (variants.length === 0) {
            newVariant.is_default = true;
        }
        const updated = [...variants, newVariant];
        onChange(updated);
        // Expand the new variant
        setExpandedIndices(prev => new Set(prev).add(updated.length - 1));
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

        if (mode === 'UNIT' && (field === "size_value" || field === "unit") && !isManualUnitLabel(updated[index])) {
            const sizeValue = field === "size_value" ? value : updated[index].size_value;
            const unit = field === "unit" ? value : updated[index].unit;
            const formattedLabel = formatSizeLabel(Number(sizeValue), unit as VariantUnit);
            updated[index].size_label = formattedLabel;
            updated[index].size_label_i18n = { ...updated[index].size_label_i18n, en: formattedLabel };
            updated[index].size_label_manual = false;
        }

        onChange(updated);
    };

    const handleVariantDeliveryConfigChange = (index: number, deliveryConfig: Partial<DeliveryConfig>) => {
        const updated = [...variants];
        updated[index] = {
            ...updated[index],
            delivery_config: deliveryConfig
        };
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
            size_label_i18n: { ...updated[index].size_label_i18n, en: preset.label },
            size_label_manual: false
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

    const isManualUnitLabel = (variant: VariantFormData): boolean => {
        if (variant.size_label_manual !== undefined) {
            return variant.size_label_manual;
        }

        if (mode !== "UNIT") {
            return true;
        }

        const autoLabel = formatSizeLabel(Number(variant.size_value), variant.unit);
        return Boolean(variant.size_label && variant.size_label !== autoLabel);
    };

    const getDiscountPercent = (mrp: number, sellingPrice: number): number => {
        if (mrp <= 0 || sellingPrice >= mrp) return 0;
        return Math.round(((mrp - sellingPrice) / mrp) * 100);
    };

    const isPriceValid = (variant: VariantFormData): boolean => {
        return variant.selling_price <= variant.mrp;
    };

    const [, setUrlTrigger] = useState(0);
    const [optimizingVariants, setOptimizingVariants] = useState<Set<number>>(new Set());
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
                <div className="space-y-4">
                    {variants.map((variant, index) => {
                        const imagePreview = getImagePreview(variant);
                        const isExpanded = expandedIndices.has(index);
                        const discount = getDiscountPercent(variant.mrp, variant.selling_price);

                        return (
                            <Card
                                key={index}
                                className={cn(
                                    "overflow-hidden transition-all duration-300 border shadow-sm",
                                    variant.is_default ? "ring-2 ring-primary bg-primary/[0.02]" : "hover:border-primary/30",
                                    !isPriceValid(variant) && "ring-2 ring-destructive",
                                    isExpanded ? "shadow-md" : "shadow-sm"
                                )}
                            >
                                {/* Variant Header - Always Visible */}
                                <div 
                                    className={cn(
                                        "flex items-center gap-3 p-3 cursor-pointer select-none transition-colors",
                                        isExpanded ? "bg-muted/50 border-b" : "bg-card hover:bg-muted/30"
                                    )}
                                    onClick={() => toggleExpand(index)}
                                >
                                    <div className="flex items-center gap-2">
                                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                                        <div className="bg-primary/10 text-primary h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold">
                                            {index + 1}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0 flex items-center gap-3">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold truncate">
                                                    {variant.size_label || `${t("common.variant")} ${index + 1}`}
                                                </span>
                                                {variant.is_default && (
                                                    <Badge variant="default" className="text-[10px] h-4 uppercase tracking-tighter px-1">
                                                        {t("admin.products.variants.default")}
                                                    </Badge>
                                                )}
                                                {!isPriceValid(variant) && (
                                                    <Badge variant="destructive" className="text-[10px] h-4 uppercase tracking-tighter px-1">
                                                        {t("admin.products.variants.priceError")}
                                                    </Badge>
                                                )}
                                            </div>
                                            
                                            {!isExpanded && (
                                                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground font-medium">
                                                    <span className="flex items-center gap-1">
                                                        <Banknote className="h-3 w-3" />
                                                        ₹{variant.selling_price}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Package className="h-3 w-3" />
                                                        {variant.stock_quantity > 0 ? `${variant.stock_quantity} in stock` : 'Out of stock'}
                                                    </span>
                                                    {variant.size_value > 0 && (
                                                        <span className="flex items-center gap-1 uppercase">
                                                            <Ruler className="h-3 w-3" />
                                                            {variant.size_value} {variant.unit}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        {discount > 0 && (
                                            <Badge variant="secondary" className="hidden sm:flex bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] h-5">
                                                {discount}% OFF
                                            </Badge>
                                        )}
                                        
                                        {!variant.is_default && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleSetDefault(index)}
                                                disabled={disabled}
                                                className="h-8 text-[11px] text-primary hover:text-primary hover:bg-primary/10"
                                            >
                                                <Check className="h-3.5 w-3.5 mr-1" />
                                                <span className="hidden sm:inline">SET DEFAULT</span>
                                            </Button>
                                        )}

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoveVariant(index)}
                                            disabled={disabled || variants.length === 1}
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => toggleExpand(index)}
                                            className="h-8 w-8 text-muted-foreground ml-1"
                                        >
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                <AnimatePresence initial={false}>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                            className="overflow-hidden"
                                        >
                                            <CardContent className="p-5 pt-4 space-y-6">
                                                {/* Core Details (Size & Description) */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="bg-amber-100 p-1 rounded">
                                                            <Info className="h-3.5 w-3.5 text-amber-700" />
                                                        </div>
                                                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                                            {t("admin.products.variants.coreInfo")}
                                                        </h4>
                                                    </div>

                                                    {mode === "UNIT" ? (
                                                        <div className="space-y-4 grid grid-cols-1 md:grid-cols-1 gap-0">
                                                            <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                                                                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 mb-2 block">
                                                                    {t("admin.products.variants.quickSizeSelect")}
                                                                </Label>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {SIZE_PRESETS.map((preset) => (
                                                                        <Button
                                                                            key={preset.label}
                                                                            type="button"
                                                                            variant={variant.size_label === preset.label ? "default" : "outline"}
                                                                            size="sm"
                                                                            onClick={() => handlePresetSelect(index, preset)}
                                                                            disabled={disabled}
                                                                            className={cn(
                                                                                "text-xs h-7 px-3 transition-all",
                                                                                variant.size_label === preset.label ? "shadow-md scale-105" : "hover:border-primary/50"
                                                                            )}
                                                                        >
                                                                            {preset.label}
                                                                        </Button>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-background p-4 rounded-xl border">
                                                                <div className="space-y-1.5">
                                                                    <Label className="text-[11px] font-bold uppercase text-muted-foreground/70 flex items-center gap-1">
                                                                        <Ruler className="h-3 w-3" /> {t("admin.products.variants.sizeValue")}
                                                                    </Label>
                                                                    <Input
                                                                        type="number"
                                                                        min="0.01"
                                                                        step="0.01"
                                                                        value={variant.size_value}
                                                                        onChange={(e) => handleVariantChange(index, "size_value", parseFloat(e.target.value) || 0)}
                                                                        disabled={disabled}
                                                                        className="h-10 font-medium"
                                                                    />
                                                                </div>

                                                                <div className="space-y-1.5">
                                                                    <Label className="text-[11px] font-bold uppercase text-muted-foreground/70">
                                                                        {t("admin.products.variants.unit")}
                                                                    </Label>
                                                                    <Select
                                                                        value={variant.unit}
                                                                        onValueChange={(value: VariantUnit) => handleVariantChange(index, "unit", value)}
                                                                        disabled={disabled}
                                                                    >
                                                                        <SelectTrigger className="h-10 font-medium">
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

                                                                <div className="space-y-1.5 md:col-span-2">
                                                                    <Label className="text-[11px] font-bold uppercase text-muted-foreground/70">
                                                                        {t("admin.products.variants.sizeLabel")}
                                                                    </Label>
                                                                    <I18nInput
                                                                        label={t("admin.products.variants.sizeLabel")}
                                                                        value={variant.size_label}
                                                                        i18nValue={variant.size_label_i18n || {}}
                                                                        onChange={(val, i18nVal) => {
                                                                            const updated = [...variants];
                                                                            updated[index] = {
                                                                                ...updated[index],
                                                                                size_label: val,
                                                                                size_label_i18n: i18nVal,
                                                                                size_label_manual: true
                                                                            };
                                                                            onChange(updated);
                                                                        }}
                                                                        placeholder={t("admin.products.variants.sizeLabelPlaceholder")}
                                                                        disabled={disabled}
                                                                        className="w-full"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-background p-4 rounded-xl border">
                                                            <div className="space-y-3">
                                                                <Label className="text-[11px] font-bold uppercase text-muted-foreground/70">
                                                                    {t("admin.products.variants.sizeLabel")}
                                                                </Label>
                                                                <div className="flex gap-2 flex-wrap pb-1">
                                                                    {SIZE_LABELS_PRESETS.map((label) => (
                                                                        <Badge
                                                                            key={label}
                                                                            variant={variant.size_label === label ? "default" : "outline"}
                                                                            className="cursor-pointer hover:bg-primary/20 transition-all text-[10px]"
                                                                            onClick={() => {
                                                                                const updated = [...variants];
                                                                                updated[index] = {
                                                                                    ...updated[index],
                                                                                    size_label: label,
                                                                                    size_label_i18n: { ...updated[index].size_label_i18n, en: label },
                                                                                    size_label_manual: true
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
                                                                        updated[index] = {
                                                                            ...updated[index],
                                                                            size_label: val,
                                                                            size_label_i18n: i18nVal,
                                                                            size_label_manual: true
                                                                        };
                                                                        onChange(updated);
                                                                    }}
                                                                    placeholder={t("admin.products.variants.sizeLabelPlaceholder")}
                                                                    disabled={disabled}
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[11px] font-bold uppercase text-muted-foreground/70">
                                                                    {t("admin.products.variants.description")}
                                                                </Label>
                                                                <I18nInput
                                                                    label={t("admin.products.variants.description")}
                                                                    type="richtext"
                                                                    value={variant.description || ''}
                                                                    i18nValue={variant.description_i18n || {}}
                                                                    onChange={(val, i18nVal) => {
                                                                        const updated = [...variants];
                                                                        updated[index] = { ...updated[index], description: val, description_i18n: i18nVal };
                                                                        onChange(updated);
                                                                    }}
                                                                    placeholder={t("admin.products.variants.descriptionPlaceholderBullets")}
                                                                    disabled={disabled}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {mode === "UNIT" && (
                                                        <div className="space-y-1.5 bg-background p-4 rounded-xl border">
                                                            <Label className="text-[11px] font-bold uppercase text-muted-foreground/70">
                                                                {t("admin.products.variants.description")}
                                                            </Label>
                                                            <I18nInput
                                                                label={t("admin.products.variants.description")}
                                                                type="richtext"
                                                                value={variant.description || ''}
                                                                i18nValue={variant.description_i18n || {}}
                                                                onChange={(val, i18nVal) => {
                                                                    const updated = [...variants];
                                                                    updated[index] = { ...updated[index], description: val, description_i18n: i18nVal };
                                                                    onChange(updated);
                                                                }}
                                                                placeholder={t("admin.products.variants.descriptionPlaceholderBullets")}
                                                                disabled={disabled}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Pricing & Inventory */}
                                                <div className="space-y-4 pt-2">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="bg-emerald-100 p-1 rounded">
                                                            <Banknote className="h-3.5 w-3.5 text-emerald-700" />
                                                        </div>
                                                        <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                                            {t("admin.products.variants.pricingInventory")}
                                                        </h4>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-emerald-50/30 p-4 rounded-xl border border-emerald-100/50">
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[11px] font-bold uppercase text-emerald-700/70">{t("admin.products.variants.mrp")} (₹)</Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={variant.mrp}
                                                                onChange={(e) => handleVariantChange(index, "mrp", parseFloat(e.target.value) || 0)}
                                                                disabled={disabled}
                                                                className="h-10 border-emerald-200/50 focus-visible:ring-emerald-500 font-semibold"
                                                            />
                                                        </div>

                                                        <div className="space-y-1.5 relative">
                                                            <Label className={cn("text-[11px] font-bold uppercase", !isPriceValid(variant) ? "text-destructive" : "text-emerald-700/70")}>
                                                                {t("admin.products.variants.sellingPrice")} (₹)
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={variant.selling_price}
                                                                onChange={(e) => handleVariantChange(index, "selling_price", parseFloat(e.target.value) || 0)}
                                                                disabled={disabled}
                                                                className={cn(
                                                                    "h-10 border-emerald-200/50 focus-visible:ring-emerald-500 font-semibold",
                                                                    !isPriceValid(variant) && "border-destructive ring-1 ring-destructive"
                                                                )}
                                                            />
                                                            {discount > 0 && (
                                                                <div className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[9px] px-1.5 rounded-full font-bold shadow-sm py-0.5">
                                                                    -{discount}%
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <Label className="text-[11px] font-bold uppercase text-emerald-700/70 flex items-center gap-1">
                                                                <Package className="h-3 w-3" /> {t("admin.products.variants.stock")}
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                value={variant.stock_quantity}
                                                                onChange={(e) => handleVariantChange(index, "stock_quantity", parseInt(e.target.value) || 0)}
                                                                disabled={disabled}
                                                                className="h-10 border-emerald-200/50 focus-visible:ring-emerald-500 font-semibold"
                                                            />
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <Label className="text-[11px] font-bold uppercase text-emerald-700/70">{t("admin.products.variants.variantImage")}</Label>
                                                            <div className="relative group">
                                                                {imagePreview ? (
                                                                    <div className="relative h-10 w-full rounded-lg overflow-hidden border border-emerald-200 bg-white">
                                                                        <img src={imagePreview} className="h-full w-full object-cover" />
                                                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                            <Button
                                                                                type="button"
                                                                                variant="destructive"
                                                                                size="icon"
                                                                                className="h-6 w-6 rounded-full"
                                                                                onClick={() => handleRemoveImage(index)}
                                                                                disabled={disabled}
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <Button 
                                                                        type="button"
                                                                        variant="outline" 
                                                                        onClick={() => !optimizingVariants.has(index) && fileInputRefs.current[index]?.click()}
                                                                        className="h-10 w-full border-dashed border-emerald-300 bg-white hover:bg-emerald-50 hover:border-emerald-500 text-emerald-600"
                                                                    >
                                                                        {optimizingVariants.has(index) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                                                        <span className="ml-2 text-xs font-bold">UPLOAD</span>
                                                                        <input
                                                                            ref={el => fileInputRefs.current[index] = el}
                                                                            type="file" accept="image/*" className="hidden"
                                                                            onChange={(e) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (file) {
                                                                                    if (file.size > MAX_ADMIN_IMAGE_SIZE_BYTES) {
                                                                                        toast({ title: t("common.error"), description: t("common.upload.fileTooLarge", { name: file.name, max: `${MAX_ADMIN_IMAGE_SIZE_MB}MB` }), variant: "destructive" });
                                                                                        return;
                                                                                    }
                                                                                    (async () => {
                                                                                        setOptimizingVariants(prev => new Set(prev).add(index));
                                                                                        try {
                                                                                            const optimizedFile = await optimizeImage(file, { maxWidth: 1920, maxHeight: 1920 });
                                                                                            handleImageUpload(index, optimizedFile);
                                                                                        } catch (error) { handleImageUpload(index, file); }
                                                                                        finally { setOptimizingVariants(prev => { const next = new Set(prev); next.delete(index); return next; }); }
                                                                                    })();
                                                                                }
                                                                            }}
                                                                            disabled={disabled}
                                                                        />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {!isPriceValid(variant) && (
                                                        <p className="text-[10px] text-destructive font-bold flex items-center gap-1 -mt-2 ml-1 uppercase tracking-tight">
                                                            <Info className="h-3 w-3" /> {t("admin.products.variants.mrpError")}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Advanced Toggle (Tax & Delivery) */}
                                                <div className="pt-2">
                                                    <Collapsible className="w-full">
                                                        <CollapsibleTrigger asChild>
                                                            <Button 
                                                                type="button"
                                                                variant="ghost" 
                                                                className="w-full flex items-center justify-between px-4 py-6 h-auto hover:bg-muted font-bold group rounded-xl border border-dashed hover:border-solid transition-all"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="bg-muted p-2 rounded-lg group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                                                        <Settings2 className="h-4 w-4" />
                                                                    </div>
                                                                    <div className="text-left">
                                                                        <p className="text-sm tracking-tight">{t("admin.products.variants.advancedSettings")}</p>
                                                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{t("admin.products.variants.taxAndDelivery")}</p>
                                                                    </div>
                                                                </div>
                                                                <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
                                                            </Button>
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent className="pt-4 space-y-6 overflow-hidden">
                                                            <div className="p-5 bg-muted/40 rounded-2xl border space-y-6">
                                                                {/* Tax Information */}
                                                                <div className="space-y-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge variant="outline" className="bg-background font-bold text-[10px] sm:px-3 sm:py-0.5">TAXATION</Badge>
                                                                        <div className="h-px bg-border flex-1" />
                                                                    </div>
                                                                    
                                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                                                        <div className="flex items-center space-x-3 h-10 px-4 bg-background border rounded-lg">
                                                                            <input
                                                                                type="checkbox"
                                                                                id={`tax-app-${index}`}
                                                                                checked={variant.tax_applicable !== false}
                                                                                onChange={(e) => handleVariantChange(index, "tax_applicable", e.target.checked)}
                                                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                                                                disabled={disabled}
                                                                            />
                                                                            <Label htmlFor={`tax-app-${index}`} className="text-xs font-bold cursor-pointer text-muted-foreground">
                                                                                {t("admin.products.variants.taxApplicable")}
                                                                            </Label>
                                                                        </div>

                                                                        {variant.tax_applicable !== false && (
                                                                            <>
                                                                                <div className="space-y-1.5 font-bold">
                                                                                    <Label className="text-[10px] uppercase text-muted-foreground">{t("admin.products.variants.hsnCode")}</Label>
                                                                                    <Input
                                                                                        value={variant.hsn_code || ''}
                                                                                        onChange={(e) => handleVariantChange(index, "hsn_code", e.target.value)}
                                                                                        placeholder="e.g. 1905"
                                                                                        className="h-10 text-xs"
                                                                                        disabled={disabled}
                                                                                    />
                                                                                </div>

                                                                                <div className="space-y-1.5 font-bold">
                                                                                    <Label className="text-[10px] uppercase text-muted-foreground">{t("admin.products.variants.gstRate")}</Label>
                                                                                    <Select
                                                                                        value={variant.gst_rate?.toString() || "0"}
                                                                                        onValueChange={(value) => handleVariantChange(index, "gst_rate", parseFloat(value))}
                                                                                        disabled={disabled}
                                                                                    >
                                                                                        <SelectTrigger className="h-10 text-xs">
                                                                                            <SelectValue placeholder="Select Rate" />
                                                                                        </SelectTrigger>
                                                                                        <SelectContent>
                                                                                            {GST_RATES.map((rate) => (
                                                                                                <SelectItem key={rate} value={rate.toString()}>{rate}%</SelectItem>
                                                                                            ))}
                                                                                        </SelectContent>
                                                                                    </Select>
                                                                                </div>

                                                                                <div className="flex items-center space-x-3 h-10 px-4 bg-background border rounded-lg">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        id={`inc-tax-${index}`}
                                                                                        checked={variant.price_includes_tax !== false}
                                                                                        onChange={(e) => handleVariantChange(index, "price_includes_tax", e.target.checked)}
                                                                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                                                                        disabled={disabled}
                                                                                    />
                                                                                    <Label htmlFor={`inc-tax-${index}`} className="text-xs font-bold cursor-pointer text-muted-foreground">
                                                                                        {t("admin.products.variants.priceIncludesTax")}
                                                                                    </Label>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Delivery Rules */}
                                                                <div className="space-y-4 pt-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <Badge variant="outline" className="bg-background font-bold text-[10px] sm:px-3 sm:py-0.5">SHIPPING RULES</Badge>
                                                                        <div className="h-px bg-border flex-1" />
                                                                    </div>
                                                                    
                                                                    <DeliveryConfigForm
                                                                        productId={productId}
                                                                        variantId={variant.id || null}
                                                                        value={variant.delivery_config || {
                                                                            calculation_type: "FLAT_PER_ORDER",
                                                                            base_delivery_charge: 0,
                                                                            max_items_per_package: 3,
                                                                            unit_weight: 0,
                                                                            gst_percentage: 18,
                                                                            is_taxable: true,
                                                                            delivery_refund_policy: "NON_REFUNDABLE",
                                                                            is_active: false
                                                                        }}
                                                                        onChange={(config) => handleVariantDeliveryConfigChange(index, config)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </CollapsibleContent>
                                                    </Collapsible>
                                                </div>
                                            </CardContent>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
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
