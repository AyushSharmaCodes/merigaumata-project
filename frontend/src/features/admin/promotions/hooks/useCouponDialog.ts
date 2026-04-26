import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/shared/hooks/use-toast";
import { logger } from "@/core/observability/logger";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { Coupon, CreateCouponDto, Product } from "@/shared/types";
import { couponService } from "@/domains/settings";
import { productService } from "@/domains/product";
import { categoryService } from "@/domains/settings";

interface UseCouponDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    coupon?: Coupon | null;
    onSave: () => void;
}

export const useCouponDialog = ({
    open,
    onOpenChange,
    coupon,
    onSave,
}: UseCouponDialogProps) => {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const [formData, setFormData] = useState<CreateCouponDto>({
        code: "",
        type: "cart",
        discount_percentage: 10,
        valid_until: "",
        is_active: true,
    });

    // Search states
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [openSelector, setOpenSelector] = useState(false);
    const [selectedEntityName, setSelectedEntityName] = useState("");

    // Fetch product categories on mount
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setLoadingCategories(true);
                const data = await categoryService.getAll("product");
                // Extract unique category names
                const uniqueCategories = [...new Set(data.map((c) => c.name))];
                setCategories(uniqueCategories);
            } catch (error) {
                logger.error("Error fetching categories:", error);
            } finally {
                setLoadingCategories(false);
            }
        };

        if (open) {
            fetchCategories();
        }
    }, [open]);

    // Fetch fresh coupon data when editing
    const { data: detailedCoupon, isLoading: isLoadingCoupon } = useQuery({
        queryKey: ["admin-coupon-detail", coupon?.id],
        queryFn: () => couponService.getById(coupon!.id),
        enabled: !!coupon?.id && open,
        staleTime: 0,
    });

    useEffect(() => {
        const source = detailedCoupon || coupon;
        if (source) {
            setFormData({
                code: source.code,
                type: source.type,
                discount_percentage: source.discount_percentage,
                target_id: source.target_id,
                min_purchase_amount: source.min_purchase_amount,
                max_discount_amount: source.max_discount_amount,
                valid_from: source.valid_from
                    ? new Date(source.valid_from).toISOString().split("T")[0]
                    : "",
                valid_until: source.valid_until ? new Date(source.valid_until).toISOString().split("T")[0] : "",
                usage_limit: source.usage_limit,
                is_active: source.is_active,
            });
        } else {
            // Reset form for new coupon
            setFormData({
                code: "",
                type: "cart",
                discount_percentage: 10,
                valid_until: "",
                is_active: true,
            });
        }
    }, [coupon, detailedCoupon, open]);

    // Entity search logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (open && (formData.type === 'product' || formData.type === 'variant')) {
                if (searchTerm.length >= 2) {
                    setIsSearching(true);
                    try {
                        const data = await productService.getAll({ search: searchTerm, limit: 10 });
                        setSearchResults(data.products || []);
                    } catch (error) {
                        logger.error("Error searching products:", error);
                    } finally {
                        setIsSearching(false);
                    }
                } else if (searchTerm.length === 0) {
                    // Fetch initial products
                    try {
                        const data = await productService.getAll({ limit: 10 });
                        setSearchResults(data.products || []);
                    } catch (error) { }
                }
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, open, formData.type]);

    // Initial load for search results
    useEffect(() => {
        if (open && (formData.type === 'product' || formData.type === 'variant') && searchResults.length === 0) {
            const fetchInitial = async () => {
                try {
                    const data = await productService.getAll({ limit: 10 });
                    setSearchResults(data.products || []);
                } catch (error) { }
            };
            fetchInitial();
        }
    }, [open, formData.type, searchResults.length]);

    // Set entity name for display when editing
    useEffect(() => {
        if (coupon && (coupon.type === 'product' || coupon.type === 'variant') && coupon.target_id) {
            const fetchEntity = async () => {
                try {
                    if (coupon.type === 'variant') {
                        const variantId = coupon.target_id as string;
                        try {
                            const variant = await productService.getVariantById(variantId);
                            if (variant && variant.product_id) {
                                const product = await productService.getById(variant.product_id);
                                setSelectedEntityName(`${product.title} (${variant.size_label})`);
                            }
                        } catch (err) {
                            // Fallback or ignore
                            logger.error("Error fetching variant details", err);
                        }
                    } else {
                        const productId = (coupon.target_id as string).split(':')[0];
                        const product = await productService.getById(productId);
                        setSelectedEntityName(product.title);
                    }
                } catch (error) { }
            };
            fetchEntity();
        } else {
            setSelectedEntityName("");
        }
    }, [coupon]);

    const handleChange = (field: keyof CreateCouponDto, value: string | number | boolean | undefined) => {
        setFormData((prev) => {
            const newData = { ...prev, [field]: value };
            // If type changed to free_delivery, set discount to 1 to satisfy DB constraint
            if (field === 'type' && value === 'free_delivery') {
                newData.discount_percentage = 1;
            } else if (field === 'type' && prev.type === 'free_delivery' && value !== 'free_delivery') {
                // If changing back from free_delivery, set a default discount
                newData.discount_percentage = 10;
            }
            return newData;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Prepare data for submission
        const dataToSave = { ...formData };

        // For free delivery, clear amount constraints as requested
        if (dataToSave.type === 'free_delivery') {
            dataToSave.min_purchase_amount = undefined;
            dataToSave.max_discount_amount = undefined;
            dataToSave.discount_percentage = 1; // Set to 1 to satisfy DB check constraint (>0)
        }

        // Validation
        if (!dataToSave.code || !dataToSave.valid_until) {
            toast({
                title: t("common.error"),
                description: t("admin.coupons.dialog.fillRequired"),
                variant: "destructive",
            });
            return;
        }

        if (dataToSave.type !== "free_delivery" && (dataToSave.discount_percentage < 1 || dataToSave.discount_percentage > 100)) {
            toast({
                title: t("common.error"),
                description: t("admin.coupons.dialog.discountRange"),
                variant: "destructive",
            });
            return;
        }

        if (
            (dataToSave.type === "product" || dataToSave.type === "category" || dataToSave.type === "variant") &&
            !dataToSave.target_id
        ) {
            toast({
                title: t("common.error"),
                description: t("admin.coupons.dialog.specifyTarget", { type: dataToSave.type }),
                variant: "destructive",
            });
            return;
        }

        try {
            setLoading(true);

            if (coupon) {
                await couponService.update(coupon.id, dataToSave);
                toast({
                    title: t("common.success"),
                    description: t("admin.coupons.updateSuccess"),
                });
            } else {
                await couponService.create(dataToSave);
                toast({
                    title: t("common.success"),
                    description: t("admin.coupons.createSuccess"),
                });
            }

            onSave();
            onOpenChange(false);
        } catch (error: unknown) {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.coupons.saveError"),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return {
        t,
        loading,
        categories,
        loadingCategories,
        formData,
        searchTerm,
        searchResults,
        isSearching,
        openSelector,
        selectedEntityName,
        isLoadingCoupon,
        setSearchTerm,
        setOpenSelector,
        handleChange,
        handleSubmit,
    };
};
