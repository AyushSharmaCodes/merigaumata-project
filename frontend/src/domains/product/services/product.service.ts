import { ProductMessages } from "@/shared/constants/messages/ProductMessages";
import { Product, ProductVariant } from "../model/product.types";
import { productApi } from "../api/product.api";

export const productService = {
    /**
     * Business logic to determine stock status text and color
     */
    getStockStatus: (inventory: number, t: (key: string, params?: any) => string) => {
        if (inventory === 0) return { text: t(ProductMessages.OUT_OF_STOCK), color: "text-red-600" };
        if (inventory < 5) return { text: t(ProductMessages.FEW_LEFT, { count: inventory }), color: "text-orange-600" };
        if (inventory < 20) return { text: t(ProductMessages.LOW_STOCK), color: "text-orange-500" };
        return { text: t(ProductMessages.IN_STOCK), color: "text-green-600" };
    },

    /**
     * Logic to get display price based on selected variant
     */
    getDisplayPrice: (product: Product, selectedVariant: ProductVariant | null) => {
        if (selectedVariant) return selectedVariant.selling_price;
        return product.price;
    },

    /**
     * Logic to get display MRP based on selected variant
     */
    getDisplayMrp: (product: Product, selectedVariant: ProductVariant | null) => {
        if (selectedVariant) return selectedVariant.mrp;
        return product.mrp;
    },

    /**
     * Logic to get display stock based on selected variant
     */
    getDisplayStock: (product: Product, selectedVariant: ProductVariant | null) => {
        if (selectedVariant) return selectedVariant.stock_quantity;
        return product.inventory || 0;
    },
    
    /**
     * Logic to collect all relevant images for a product and its variants
     */
    getAllImages: (product: Product) => {
        const images = [...(product.images || [])];
        if (product.variants) {
            product.variants.forEach((variant) => {
                if (variant.variant_image_url && !images.includes(variant.variant_image_url)) {
                    images.push(variant.variant_image_url);
                }
            });
        }
        return images;
    },

    // ─── CRUD Delegation (from productApi) ──────────────────────────────────
    // These delegate to productApi so consumers can call productService.getAll() etc.

    getAll: productApi.getAll,
    getById: productApi.getById,
    create: productApi.create,
    update: productApi.update,
    delete: productApi.delete,
    createWithVariants: productApi.createWithVariants,
    updateWithVariants: productApi.updateWithVariants,
    getVariantById: productApi.getVariantById,
};

