import { logger } from "@/lib/logger";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUpload } from "./ImageUpload";
import { VariantFormSection } from "./VariantFormSection";
import { DeliveryConfigForm } from "./DeliveryConfigForm";
import type { Product, VariantFormData, DeliveryConfig } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Package, Loader2, RotateCcw, Tag } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { categoryService } from "@/services/category.service";
import { productService } from "@/services/product.service";
import { uploadService } from "@/services/upload.service";
import { I18nInput } from "./I18nInput";
import { availableLanguages } from "@/i18n/config";
import { getLocalizedContent } from "@/utils/localizationUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSave: (product: Omit<Partial<Product>, 'variants' | 'delivery_config'> & { imageFiles?: (File | string)[], variants?: VariantFormData[], delivery_config?: Partial<DeliveryConfig> }) => void;
  isSaving?: boolean;
}

import { AVAILABLE_TAGS } from "@/constants/productConstants";

const EMPTY_CATEGORIES: any[] = [];

function isUnitVariantLabelManual(sizeValue: number, unit: string, sizeLabel?: string | null) {
  if (!sizeLabel) return false;

  const numericValue = Number(sizeValue);

  if (unit === "kg" && numericValue < 1) {
    return sizeLabel !== `${numericValue * 1000} GM`;
  }

  if (unit === "ltr" && numericValue < 1) {
    return sizeLabel !== `${numericValue * 1000} ML`;
  }

  return sizeLabel !== `${numericValue} ${String(unit || "").toUpperCase()}`;
}

function getBaseFieldValue<T extends string | string[] | undefined>(
  localizedValue: T,
  i18nMap: Record<string, any> | undefined,
  fallback: T
): T {
  if (i18nMap && Object.prototype.hasOwnProperty.call(i18nMap, "en")) {
    return i18nMap.en as T;
  }

  if (localizedValue !== undefined && localizedValue !== null) {
    return localizedValue;
  }

  return fallback;
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  onSave,
  isSaving = false,
}: ProductDialogProps) {
  const { t, i18n } = useTranslation();
  // Fetch categories dynamically
  const { data: categories = EMPTY_CATEGORIES } = useQuery({
    queryKey: ["categories", "product"],
    queryFn: async () => {
      return categoryService.getAll("product");
    },
  });
  const [formData, setFormData] = useState<Partial<Product> & { imageFiles?: (File | string)[] }>({
    title: "",
    title_i18n: {},
    description: "",
    description_i18n: {},
    price: 0,
    mrp: 0,
    images: [],
    imageFiles: [],
    category: "Dairy",
    category_id: undefined,
    tags: [],
    tags_i18n: {},
    inventory: 0,
    benefits: [],
    benefits_i18n: {},
    isReturnable: false,
    returnDays: 0,
    isNew: false,
    createdAt: new Date().toISOString(),
    variant_mode: 'UNIT',
    default_tax_applicable: true,
    default_price_includes_tax: true,
    default_gst_rate: 0,
    default_hsn_code: "",
  });
  const [variants, setVariants] = useState<VariantFormData[]>([]);
  const [variantsOpen, setVariantsOpen] = useState(true);
  const [benefitInput, setBenefitInput] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [originalImages, setOriginalImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [removedVariantImages, setRemovedVariantImages] = useState<string[]>([]);
  const [deliveryConfig, setDeliveryConfig] = useState<Partial<DeliveryConfig>>({
    calculation_type: "FLAT_PER_ORDER",
    base_delivery_charge: 0,
    max_items_per_package: 3,
    unit_weight: 0,
    gst_percentage: 18,
    is_taxable: true,
    delivery_refund_policy: "NON_REFUNDABLE",
    is_active: false, // Default to false so users must explicitly enable custom rules
  });

  const prevDetailedProductRef = useRef<any>(null);

  // Fetch detailed product data when editing
  const { data: detailedProduct, isLoading: isLoadingProduct } = useQuery({
    queryKey: ["product", product?.id],
    queryFn: async () => {
      if (!product?.id) return null;
      return productService.getById(product.id);
    },
    enabled: !!product?.id && open,
  });

  useEffect(() => {
    if (open) {
      if (product) {
        // Use detailedProduct if available, otherwise fallback to product prop
        const productData = detailedProduct || product;

        // Store original images to track deletions
        const originalImageUrls = productData.images || [];
        setOriginalImages(originalImageUrls);
        setRemovedImages([]);

        // Initialize form data only if we just switched products or opened the dialog
        // This prevents overwriting user changes while they are typing if detailedProduct finishes loading later
        const shouldInitialize = !formData.id || formData.id !== productData.id;
        const shouldUpdateFromDetailed = detailedProduct && !prevDetailedProductRef.current;

        if (shouldInitialize || shouldUpdateFromDetailed) {
          // Resolve category_id if missing or ensure it matches the name
          let resolvedCategoryId = (productData as any).category_id;
          let resolvedCategoryName = (productData as any).category || "";

          // If we have a category name but no ID (or invalid ID), try to find ID from name
          if (!resolvedCategoryId && resolvedCategoryName) {
            const matchedCategory = categories.find(c => c.name === resolvedCategoryName);
            if (matchedCategory) {
              resolvedCategoryId = matchedCategory.id;
            }
          }

          // If we have an ID but name might be outdated/missing, ensure name is correct
          if (resolvedCategoryId) {
            const matchedCategory = categories.find(c => c.id === resolvedCategoryId);
            if (matchedCategory) {
              resolvedCategoryName = matchedCategory.name;
            }
          }

          // If still no ID (e.g. new product or invalid category), default to first category if available
          if (!resolvedCategoryId && categories.length > 0) {
            resolvedCategoryId = categories[0].id;
            resolvedCategoryName = categories[0].name;
          }

          // If updating from detailed, we prefer currently edited values for title/description if they aren't empty
          // but we prioritize correctly loaded metadata like return policy
          setFormData({
            id: productData.id,
            title: (shouldUpdateFromDetailed && formData.title)
              ? formData.title
              : getBaseFieldValue(productData.title, (productData as any).title_i18n, ""),
            description: (shouldUpdateFromDetailed && formData.description)
              ? formData.description
              : getBaseFieldValue(productData.description, (productData as any).description_i18n, ""),
            price: productData.price || 0,
            mrp: productData.mrp || productData.price || 0,
            category: resolvedCategoryName,
            category_id: resolvedCategoryId,
            tags: getBaseFieldValue(productData.tags, (productData as any).tags_i18n, []),
            tags_i18n: (productData as any).tags_i18n || {},
            inventory: productData.inventory || 0,
            benefits: getBaseFieldValue(productData.benefits, productData.benefits_i18n, []),
            benefits_i18n: productData.benefits_i18n || {},
            isReturnable: (productData as any).is_returnable === true || productData.isReturnable === true,
            returnDays: (productData as any).return_days ?? productData.returnDays ?? 3,
            isNew: productData.isNew ?? false,
            createdAt: productData.createdAt || (productData as any).created_at || new Date().toISOString(),
            variant_mode: productData.variant_mode || 'UNIT',
            imageFiles: originalImageUrls,
            default_hsn_code: productData.default_hsn_code || (productData as any).default_hsn_code || "",
            default_gst_rate: productData.default_gst_rate ?? (productData as any).default_gst_rate ?? 0,
            default_tax_applicable: (productData as any).default_tax_applicable ?? productData.default_tax_applicable ?? true,
            default_price_includes_tax: (productData as any).default_price_includes_tax ?? productData.default_price_includes_tax ?? true,
            title_i18n: (productData as any).title_i18n || {},
            description_i18n: (productData as any).description_i18n || {},
          });

          // Initialize Delivery Config
          if ((productData as any).delivery_config) {
            const config = (productData as any).delivery_config;
            setDeliveryConfig({
              calculation_type: config.calculation_type || "FLAT_PER_ORDER",
              base_delivery_charge: config.base_delivery_charge ?? 0,
              max_items_per_package: config.max_items_per_package ?? 3,
              unit_weight: config.unit_weight ?? 0,
              gst_percentage: config.gst_percentage ?? 18,
              is_taxable: config.is_taxable ?? true,
              delivery_refund_policy: config.delivery_refund_policy || "NON_REFUNDABLE",
              is_active: config.is_active ?? false,
            });
          } else {
            // Reset to defaults if no config exists for this product
            setDeliveryConfig({
              calculation_type: "FLAT_PER_ORDER",
              base_delivery_charge: 0,
              max_items_per_package: 3,
              unit_weight: 0,
              gst_percentage: 18,
              is_taxable: true,
              delivery_refund_policy: "NON_REFUNDABLE",
              is_active: false,
            });
          }
        }

        // Update ref for the next render
        prevDetailedProductRef.current = detailedProduct;

        // Initialize variants from product
        if (productData.variants && productData.variants.length > 0) {
          setVariants(productData.variants.map((v: any) => ({
            id: v.id,
            size_label: getBaseFieldValue(v.size_label, v.size_label_i18n, ""),
            size_label_i18n: v.size_label_i18n || {},
            size_label_manual: productData.variant_mode === 'UNIT'
              ? isUnitVariantLabelManual(v.size_value, v.unit, getBaseFieldValue(v.size_label, v.size_label_i18n, ""))
              : true,
            size_value: v.size_value,
            unit: v.unit,
            description: getBaseFieldValue(v.description, v.description_i18n, ""),
            description_i18n: v.description_i18n || {},
            mrp: v.mrp,
            selling_price: v.selling_price,
            stock_quantity: v.stock_quantity,
            variant_image_url: v.variant_image_url,
            is_default: v.is_default,
            hsn_code: v.hsn_code || "",
            gst_rate: v.gst_rate || 0,
            tax_applicable: v.tax_applicable !== false,
            price_includes_tax: v.price_includes_tax !== false,
          })));
        } else {
          setVariants([]);
        }
      } else {
        setOriginalImages([]);
        setRemovedImages([]);
        setVariants([]);

        setFormData({
          title: "",
          description: "",
          price: 0,
          mrp: 0,
          images: [],
          imageFiles: [],
          category: categories.length > 0 ? categories[0].name : "",
          category_id: categories.length > 0 ? categories[0].id : undefined,
          tags: [],
          inventory: 0,
          benefits: [],
          benefits_i18n: {},
          isReturnable: false,
          returnDays: 0,
          isNew: true,
          createdAt: new Date().toISOString(),
          variant_mode: 'UNIT',
          default_hsn_code: "",
          default_gst_rate: 0,
          default_tax_applicable: true,
          default_price_includes_tax: true,
          title_i18n: {},
          description_i18n: {},
          tags_i18n: {},
        });
      }
      setBenefitInput("");
      setCustomTag("");
    } else {
      // Reset state on close to prevent stale data and blob URL errors
      setOriginalImages([]);
      setRemovedImages([]);
      setVariants([]);
      setFormData({
        title: "",
        description: "",
        price: 0,
        mrp: 0,
        images: [],
        imageFiles: [],
        category: categories.length > 0 ? categories[0].name : "",
        category_id: categories.length > 0 ? categories[0].id : undefined,
        tags: [],
        inventory: 0,
        benefits: [],
        isReturnable: false,
        returnDays: 0,
        isNew: false,
        createdAt: new Date().toISOString(),
        variant_mode: 'UNIT',
        default_tax_applicable: true,
        default_price_includes_tax: true,
        default_gst_rate: 0,

        default_hsn_code: "",
      });
      setDeliveryConfig({
        calculation_type: "FLAT_PER_ORDER",
        base_delivery_charge: 0,
        gst_percentage: 0,
        delivery_refund_policy: "NON_REFUNDABLE",
        is_active: false, // Reset to false on close
      });
      setBenefitInput("");
      setCustomTag("");
    }
  }, [product, detailedProduct, open, categories]);

  // Inventory Calculation Effect
  useEffect(() => {
    if (variants && variants.length > 0) {
      const totalStock = variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
      // Only update if different to avoid infinite loops
      if (formData.inventory !== totalStock) {
        setFormData(prev => ({ ...prev, inventory: totalStock }));
      }
    }
  }, [variants, formData.inventory]); // Added formData.inventory to correct deps, but carefully managed inside

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.debug("ProductDialog - Submitting product:", formData);

    // Validate required fields
    if (!formData.title?.trim() || !formData.description?.trim()) {
      alert(t('errors.fillRequired'));
      return;
    }

    // Validate duplicate variants
    if (variants.length > 0) {
      const sizeLabels = variants.map(v => v.size_label?.trim().toLowerCase());
      const uniqueLabels = new Set(sizeLabels);
      if (uniqueLabels.size !== sizeLabels.length) {
        alert(t('errors.inventory.duplicateVariants'));
        return;
      }
    }

    // Validate Price/MRP only if NO variants are present
    if (variants.length === 0) {
      if (!formData.price || !formData.mrp) {
        alert(t('errors.inventory.priceRequiredNoVariants'));
        return;
      }
    }

    // Validate Category
    let finalCategoryId = formData.category_id;
    if (!finalCategoryId) {
      // Try to resolve from name one last time
      const matchedCategory = categories.find(c => c.name === formData.category);
      if (matchedCategory) {
        finalCategoryId = matchedCategory.id;
        // Update formData to reflect this resolution
        setFormData(prev => ({ ...prev, category_id: finalCategoryId }));
      } else {
        alert("Please select a valid category.");
        return;
      }
    }

    // Check for either existing images or new image files
    if ((!formData.imageFiles || formData.imageFiles.length === 0) && (!formData.images || formData.images.length === 0)) {
      alert(t('errors.inventory.imageRequired'));
      return;
    }

    // Delete removed images from Supabase Storage
    if (removedImages.length > 0) {
      logger.debug("Deleting removed images:", removedImages);

      for (const imageUrl of removedImages) {
        try {
          await uploadService.deleteImageByUrl(imageUrl);
          logger.debug("Deleted removed image:", imageUrl);
        } catch (error) {
          logger.error("Failed to delete removed image: " + imageUrl, error);
          // Continue even if deletion fails
        }
      }
    }

    // Delete removed VARIANT images from Supabase Storage
    if (removedVariantImages.length > 0) {
      logger.debug("Deleting removed variant images:", removedVariantImages);

      for (const imageUrl of removedVariantImages) {
        try {
          await uploadService.deleteImageByUrl(imageUrl);
          logger.debug("Deleted removed variant image:", imageUrl);
        } catch (error) {
          logger.error("Failed to delete removed variant image: " + imageUrl, error);
          // Continue even if deletion fails
        }
      }
    }

    // Pass imageFiles and variants to parent
    // Pass clean data to parent
    const { images, ...cleanedFormData } = formData;

    // Use the locally resolved finalCategoryId to ensure it's not missing
    const submissionData = {
      ...cleanedFormData,
      category_id: finalCategoryId, // Use the resolved ID
      imageFiles: formData.imageFiles,
      variants,
      delivery_config: deliveryConfig,
    };

    onSave(submissionData);
  };

  const handleImagesChange = (images: (string | File)[]) => {
    // Track which images were removed
    const currentImageUrls = images.filter(img => typeof img === 'string') as string[];
    const removed = originalImages.filter(url => !currentImageUrls.includes(url));

    setRemovedImages(removed);
    setFormData({ ...formData, imageFiles: images });
  };

  const discountPercentage =
    formData.mrp && formData.price && formData.mrp > formData.price
      ? Math.round(((formData.mrp - formData.price) / formData.mrp) * 100)
      : 0;

  const [activeTagTab, setActiveTagTab] = useState("en");

  const handleTagToggle = (tag: string, lang: string) => {
    if (lang === 'en') {
      const currentTags = formData.tags || [];
      const newTags = currentTags.includes(tag)
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag];
      setFormData({ ...formData, tags: newTags });
    } else {
      const currentI18n = formData.tags_i18n || {};
      const currentTags = currentI18n[lang] || [];
      const newTags = currentTags.includes(tag)
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag];

      setFormData({
        ...formData,
        tags_i18n: {
          ...currentI18n,
          [lang]: newTags
        }
      });
    }
  };

  const addCustomTag = (lang: string) => {
    const tagToAdd = customTag.trim();
    if (!tagToAdd) return;

    if (lang === 'en') {
      if (!formData.tags?.includes(tagToAdd.toLowerCase())) {
        setFormData({
          ...formData,
          tags: [...(formData.tags || []), tagToAdd.toLowerCase()],
        });
      }
    } else {
      const currentI18n = formData.tags_i18n || {};
      const currentTags = currentI18n[lang] || [];
      if (!currentTags.includes(tagToAdd)) { // Keep original case for localized tags? Or lowercase? User choice. Let's keep original for non-EN.
        setFormData({
          ...formData,
          tags_i18n: {
            ...currentI18n,
            [lang]: [...currentTags, tagToAdd]
          }
        });
      }
    }
    setCustomTag("");
  };

  const removeTag = (tag: string, lang: string) => {
    if (lang === 'en') {
      setFormData({
        ...formData,
        tags: formData.tags?.filter((t) => t !== tag),
      });
    } else {
      const currentI18n = formData.tags_i18n || {};
      const currentTags = currentI18n[lang] || [];
      setFormData({
        ...formData,
        tags_i18n: {
          ...currentI18n,
          [lang]: currentTags.filter((t) => t !== tag)
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 sm:rounded-2xl overflow-hidden shadow-2xl border-border/50">
        <DialogHeader className="px-6 py-4 border-b bg-muted/20 sticky top-0 z-10 backdrop-blur-sm">
          <DialogTitle>
            {product ? t('admin.products.dialog.editTitle') : t('admin.products.dialog.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {product
              ? t('admin.products.dialog.editDesc')
              : t('admin.products.dialog.addDesc')}
          </DialogDescription>
        </DialogHeader>

        {/* Loading Overlay for Save Operations */}
        <LoadingOverlay
          isLoading={isSaving}
          message={product ? t('admin.products.dialog.savingChanges') : t('admin.products.dialog.creatingProduct')}
        />

        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <form onSubmit={handleSubmit} className="space-y-8 p-6">
            {/* Product Images */}
            <div className="space-y-4 border border-border/50 rounded-xl p-6 bg-gradient-to-br from-background to-muted/10 shadow-sm transition-all hover:shadow-md">
              <Label className="text-lg font-semibold tracking-tight text-foreground">
                {t('admin.products.dialog.images.title')}
              </Label>
              <p className="text-sm text-muted-foreground mb-2">
                {t('admin.products.dialog.images.desc')}
              </p>
              <ImageUpload
                images={formData.imageFiles || []}
                onChange={handleImagesChange}
                maxImages={5}
                type="product"
              />
            </div>

            {/* Basic Information */}
            <div className="space-y-6 border border-border/50 rounded-xl p-6 bg-card shadow-sm transition-all hover:shadow-md">
              <div className="border-b border-border/50 pb-3"><h3 className="text-lg font-semibold tracking-tight">{t('admin.products.dialog.basic.title')}</h3></div>

              <div className="space-y-4">
                <I18nInput
                  label={t('admin.products.dialog.basic.name')}
                  value={formData.title || ""}
                  i18nValue={formData.title_i18n || {}}
                  onChange={(val, i18nVal) => setFormData({ ...formData, title: val, title_i18n: i18nVal })}
                  placeholder={t('admin.products.dialog.basic.namePlaceholder')}
                  required
                />

                <I18nInput
                  label={t('admin.products.dialog.basic.description')}
                  type="textarea"
                  value={formData.description || ""}
                  i18nValue={formData.description_i18n || {}}
                  onChange={(val, i18nVal) => setFormData({ ...formData, description: val, description_i18n: i18nVal })}
                  placeholder={t('admin.products.dialog.basic.descriptionPlaceholder')}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">
                  {t('admin.products.dialog.basic.category')} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.category_id || (categories.find(c => c.name === formData.category)?.id) || ""}
                  name="category"
                  onValueChange={(value) => {
                    const selectedCat = categories.find(c => c.id === value);
                    setFormData({
                      ...formData,
                      category_id: value,
                      category: selectedCat ? (selectedCat.name) : (formData.category || '')
                    });
                  }}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder={t('admin.products.dialog.basic.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 ? (
                      <SelectItem value="no-categories" disabled>
                        {t('admin.products.dialog.basic.noCategories')}
                      </SelectItem>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {getLocalizedContent(cat, i18n.language)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-6 border border-border/50 rounded-xl p-6 bg-card shadow-sm transition-all hover:shadow-md">
              <div className="border-b border-border/50 pb-3"><h3 className="text-lg font-semibold tracking-tight">{t('admin.products.dialog.pricing.title')}</h3></div>
              {variants.length > 0 && (
                <p className="text-xs text-muted-foreground -mt-2">
                  {t('admin.products.dialog.pricing.optionalHint')}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mrp">
                    {t('admin.products.dialog.pricing.mrp')} {variants.length === 0 && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="mrp"
                    name="mrp"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.mrp || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        mrp: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder={variants.length > 0
                      ? t('admin.products.dialog.pricing.mrpPlaceholderAuto')
                      : t('admin.products.dialog.pricing.mrpPlaceholderManual')}
                    required={variants.length === 0}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">
                    {t('admin.products.dialog.pricing.sellingPrice')}{" "}
                    {variants.length === 0 && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder={variants.length > 0
                      ? t('admin.products.dialog.pricing.sellingPricePlaceholderAuto')
                      : t('admin.products.dialog.pricing.sellingPricePlaceholderManual')}
                    required={variants.length === 0}
                  />
                </div>


              </div>

              {discountPercentage > 0 && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg shadow-sm">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2"><Tag className="h-4 w-4" />
                    {t('admin.products.dialog.pricing.discount', { percent: discountPercentage })}
                  </p>
                </div>
              )}
            </div>

            {/* Tax Configuration */}
            <div className="space-y-6 border border-border/50 rounded-xl p-6 bg-card shadow-sm transition-all hover:shadow-md">
              <div className="border-b border-border/50 pb-3"><h3 className="text-lg font-semibold tracking-tight">{t('admin.products.dialog.tax.title')}</h3></div>
              <p className="text-sm text-muted-foreground">
                {t('admin.products.dialog.tax.desc')}
              </p>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="default-tax-applicable"
                  checked={formData.default_tax_applicable !== false}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, default_tax_applicable: checked as boolean })
                  }
                />
                <Label>{t('admin.products.dialog.tax.applicable')}</Label>
              </div>

              {formData.default_tax_applicable !== false && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="default-hsn">{t('admin.products.dialog.tax.hsn')}</Label>
                    <Input
                      id="default-hsn"
                      value={formData.default_hsn_code || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, default_hsn_code: e.target.value })
                      }
                      placeholder="e.g. 1905"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="default-gst">{t('admin.products.dialog.tax.gstRate')}</Label>
                    <Select
                      value={formData.default_gst_rate?.toString() || "0"}
                      onValueChange={(value) =>
                        setFormData({ ...formData, default_gst_rate: parseFloat(value) })
                      }
                    >
                      <SelectTrigger id="default-gst">
                        <SelectValue placeholder={t('admin.products.dialog.tax.selectRate')} />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 5, 12, 18, 28].map((rate) => (
                          <SelectItem key={rate} value={rate.toString()}>
                            {rate}%
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2 md:col-span-2">
                    <Checkbox
                      id="default-inc-tax"
                      checked={formData.default_price_includes_tax !== false}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, default_price_includes_tax: checked as boolean })
                      }
                    />
                    <Label>{t('admin.products.dialog.tax.priceIncludesTax')}</Label>
                  </div>
                </div>
              )}
            </div>

            {/* Variant Mode Selection */}
            <div className="space-y-5 border border-border/50 rounded-xl p-6 bg-gradient-to-br from-card to-muted/20 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{t('admin.products.dialog.variants.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('admin.products.dialog.variants.desc')}
                  </p>
                </div>
                <div className="flex items-center space-x-2 bg-background p-1 rounded-lg border">
                  <Button
                    type="button"
                    variant={formData.variant_mode === 'UNIT' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      // Clear variants if mode changes to avoid schema mismatch
                      if (formData.variant_mode !== 'UNIT' && variants.length > 0) {
                        if (confirm(t('admin.products.dialog.variants.clearConfirm'))) {
                          setVariants([]);
                          setFormData({ ...formData, variant_mode: 'UNIT' });
                        }
                      } else {
                        setFormData({ ...formData, variant_mode: 'UNIT' });
                      }
                    }}
                  >
                    {t('admin.products.dialog.variants.weightMode')}
                  </Button>
                  <Button
                    type="button"
                    variant={formData.variant_mode === 'SIZE' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      if (formData.variant_mode !== 'SIZE' && variants.length > 0) {
                        if (confirm(t('admin.products.dialog.variants.clearConfirm'))) {
                          setVariants([]);
                          setFormData({ ...formData, variant_mode: 'SIZE' });
                        }
                      } else {
                        setFormData({ ...formData, variant_mode: 'SIZE' });
                      }
                    }}
                  >
                    {t('admin.products.dialog.variants.sizeMode')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Delivery Configuration */}
            <div className="space-y-5 border border-border/50 rounded-xl p-6 bg-gradient-to-br from-card to-muted/20 shadow-sm transition-all hover:shadow-md">
              <DeliveryConfigForm
                productId={product?.id || ""}
                value={deliveryConfig}
                onChange={setDeliveryConfig}
              />
            </div>

            {/* Size Variants */}
            <Collapsible open={variantsOpen} onOpenChange={setVariantsOpen}>
              <div className="space-y-6 border border-border/50 rounded-xl p-6 bg-card shadow-sm transition-all hover:shadow-md">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -m-6 p-6 rounded-t-xl transition-colors border-b border-border/50 bg-muted/5">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <h3 className="text-lg font-semibold tracking-tight">
                        {formData.variant_mode === 'SIZE'
                          ? t('admin.products.dialog.variants.sizeTitle')
                          : t('admin.products.dialog.variants.unitTitle')}
                      </h3>
                      {variants.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {t('admin.products.dialog.variants.variantCount', { count: variants.length })}
                        </Badge>
                      )}
                      {variants.length > 0 && !variants.some(v => v.is_default) && (
                        <Badge variant="destructive" className="ml-1 text-xs">
                          {t('admin.products.dialog.variants.noDefault')}
                        </Badge>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm">
                      {variantsOpen ? t('admin.products.dialog.variants.collapse') : t('admin.products.dialog.variants.expand')}
                    </Button>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <VariantFormSection
                    variants={variants}
                    onChange={setVariants}
                    mode={formData.variant_mode || 'UNIT'}
                    onVariantImageRemoved={(url) => setRemovedVariantImages((prev) => [...prev, url])}
                  />
                </CollapsibleContent>
              </div>
            </Collapsible>


            {/* Inventory */}
            <div className="space-y-6 border border-border/50 rounded-xl p-6 bg-card shadow-sm transition-all hover:shadow-md">
              <h3 className="text-lg font-semibold tracking-tight">{t('admin.products.dialog.inventory.title')}</h3>

              <div className="space-y-2">
                <Label htmlFor="inventory">
                  {t('admin.products.dialog.inventory.stock')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="inventory"
                  name="inventory"
                  type="number"
                  min="0"
                  value={formData.inventory}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      inventory: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder={t('admin.products.dialog.inventory.stockPlaceholder')}
                  required
                />
                {formData.inventory !== undefined &&
                  formData.inventory < 15 && (
                    <p className="text-sm text-destructive font-medium">
                      {t('admin.products.dialog.inventory.lowStock', { count: formData.inventory })}
                    </p>
                  )}
                {formData.inventory !== undefined &&
                  formData.inventory >= 15 &&
                  formData.inventory < 50 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                      {t('admin.products.dialog.inventory.runningLow', { count: formData.inventory })}
                    </p>
                  )}
              </div>
            </div>

            <div className="space-y-5 border border-border/50 rounded-xl p-6 bg-card shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <h3 className="text-lg font-semibold tracking-tight">{t('admin.products.dialog.benefits.title')}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('admin.products.dialog.benefits.desc')}
              </p>

              <Tabs defaultValue="en" className="w-full">
                <TabsList className="h-10 p-1 bg-muted/50 rounded-lg w-full justify-start mb-4 overflow-x-auto border border-border/50">
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

                {availableLanguages.map((lang) => (
                  <TabsContent key={lang} value={lang} className="space-y-4 mt-0 ring-0 focus-visible:ring-0">
                    <div className="flex gap-2">
                      <Input
                        placeholder={`${t('admin.products.dialog.benefits.placeholder')} (${lang.toUpperCase()})`}
                        value={benefitInput}
                        onChange={(e) => setBenefitInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (benefitInput.trim()) {
                              const currentBenefits = lang === 'en'
                                ? (formData.benefits || [])
                                : (formData.benefits_i18n?.[lang] || []);

                              const newBenefits = [...currentBenefits, benefitInput.trim()];

                              if (lang === 'en') {
                                setFormData({
                                  ...formData,
                                  benefits: newBenefits,
                                  benefits_i18n: { ...formData.benefits_i18n, [lang]: newBenefits }
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  benefits_i18n: { ...formData.benefits_i18n, [lang]: newBenefits }
                                });
                              }
                              setBenefitInput("");
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        onClick={() => {
                          if (benefitInput.trim()) {
                            const currentBenefits = lang === 'en'
                              ? (formData.benefits || [])
                              : (formData.benefits_i18n?.[lang] || []);

                            const newBenefits = [...currentBenefits, benefitInput.trim()];

                            if (lang === 'en') {
                              setFormData({
                                ...formData,
                                benefits: newBenefits,
                                benefits_i18n: { ...formData.benefits_i18n, [lang]: newBenefits }
                              });
                            } else {
                              setFormData({
                                ...formData,
                                benefits_i18n: { ...formData.benefits_i18n, [lang]: newBenefits }
                              });
                            }
                            setBenefitInput("");
                          }
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {(lang === 'en' ? (formData.benefits || []) : (formData.benefits_i18n?.[lang] || [])).map((benefit, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-muted/40 rounded-md group"
                        >
                          <span className="text-sm">{benefit}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              const currentBenefits = lang === 'en'
                                ? (formData.benefits || [])
                                : (formData.benefits_i18n?.[lang] || []);

                              const newBenefits = currentBenefits.filter((_, i) => i !== index);

                              if (lang === 'en') {
                                setFormData({
                                  ...formData,
                                  benefits: newBenefits,
                                  benefits_i18n: { ...formData.benefits_i18n, [lang]: newBenefits }
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  benefits_i18n: { ...formData.benefits_i18n, [lang]: newBenefits }
                                });
                              }
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>

            <div className="space-y-6 border border-border/50 rounded-xl p-6 bg-card shadow-sm transition-all hover:shadow-md">
              <h3 className="text-lg font-semibold tracking-tight">{t('admin.products.dialog.tags.title')}</h3>
              <p className="text-sm text-muted-foreground">{t('admin.products.dialog.tags.desc')}</p>

              <div className="space-y-3 pb-2 border-b">
                <Label className="text-sm font-medium">{t('admin.products.dialog.tags.selectTags')}</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {AVAILABLE_TAGS.map((tag) => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tag-${tag}-predefined`}
                        checked={(formData.tags || []).includes(tag)}
                        onCheckedChange={() => handleTagToggle(tag, 'en')}
                      />
                      <Label
                        htmlFor={`tag-${tag}-predefined`}
                        className="text-sm font-normal cursor-pointer hover:text-primary transition-colors"
                      >
                        {t(`products.tags.${tag}`)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Tabs value={activeTagTab} onValueChange={setActiveTagTab} className="w-full">
                <TabsList className="h-10 p-1 bg-muted/50 rounded-lg w-full justify-start mb-4 overflow-x-auto border border-border/50">
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

                {availableLanguages.map((lang) => {
                  // Predefined tags selected (from global tags array)
                  const selectedPredefined = (formData.tags || []).filter(t => AVAILABLE_TAGS.includes(t));
                  // Localized tags for this specific tab
                  const localizedTags = lang === 'en'
                    ? (formData.tags || []).filter(t => !AVAILABLE_TAGS.includes(t))
                    : (formData.tags_i18n?.[lang] || []);

                  const displayTags = [...selectedPredefined, ...localizedTags];

                  return (
                    <TabsContent key={lang} value={lang} className="space-y-4">
                      <div className="space-y-2">
                        <Label>{t('admin.products.dialog.tags.addNew')}</Label>
                        <div className="flex gap-2">
                          <Input
                            value={customTag}
                            onChange={(e) => setCustomTag(e.target.value)}
                            placeholder={t('admin.products.dialog.tags.placeholder')}
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addCustomTag(lang);
                              }
                            }}
                          />
                          <Button
                            type="button"
                            onClick={() => addCustomTag(lang)}
                            size="icon"
                            className="shrink-0"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Active Tags Display */}
                      {displayTags.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {displayTags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="pl-2 pr-1 py-1">
                              {AVAILABLE_TAGS.includes(tag) ? t(`products.tags.${tag}`) : tag}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 ml-1 hover:bg-transparent hover:text-destructive"
                                onClick={() => removeTag(tag, AVAILABLE_TAGS.includes(tag) ? 'en' : lang)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </div>

            {/* Return Policy */}
            <div className="space-y-6 border border-border/50 rounded-xl p-6 bg-gradient-to-br from-card to-muted/20 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center gap-2 mb-2">
                <RotateCcw className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold tracking-tight">{t('admin.products.dialog.return.title')}</h3>
              </div>

              <div className="space-y-6">
                <RadioGroup
                  value={formData.isReturnable ? "returnable" : "non-returnable"}
                  onValueChange={(value) => {
                    const isReturnable = value === "returnable";
                    setFormData({
                      ...formData,
                      isReturnable,
                      returnDays: isReturnable ? (formData.returnDays || 3) : 0
                    });
                  }}
                  className="grid gap-4"
                >
                  <div className="flex items-start space-x-3 space-y-0">
                    <RadioGroupItem value="returnable" id="returnable" className="mt-1" />
                    <div className="grid gap-1.5 leading-none">
                      <Label className="font-semibold cursor-pointer text-sm">
                        {t('admin.products.dialog.return.returnable')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('admin.products.dialog.return.returnableDesc')}
                      </p>

                      {formData.isReturnable && (
                        <div className="mt-3 p-3 bg-background border rounded-md space-y-3 max-w-[200px]">
                          <Label htmlFor="returnDays" className="text-xs font-medium">
                            {t('admin.products.dialog.return.days')}
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="returnDays"
                              name="returnDays"
                              type="number"
                              min="0"
                              max="30"
                              value={formData.returnDays?.toString()}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setFormData({ ...formData, returnDays: isNaN(val) ? 0 : val });
                              }}
                              className="h-8 w-20 text-center font-medium"
                            />
                            <span className="text-xs text-muted-foreground">{t("admin.products.dialog.return.daysLabel")}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 space-y-0">
                    <RadioGroupItem value="non-returnable" id="non-returnable" className="mt-1" />
                    <div className="grid gap-1.5 leading-none">
                      <Label className="font-semibold cursor-pointer text-sm">
                        {t('admin.products.dialog.return.nonReturnable')}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t('admin.products.dialog.return.nonReturnableDesc')}
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </div>

            <DialogFooter className="gap-3 pt-6 border-t border-border/50 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {product ? t('common.update') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
