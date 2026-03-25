import { Coupon } from "@/types";
import { logger } from "@/lib/logger";

interface CachedCoupon extends Coupon {
    cachedAt: number;
}

interface CouponCacheData {
    coupons: CachedCoupon[];
    fetchedAt: number;
}

const CACHE_KEY = "active_coupons_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCouponStorage(): Storage | null {
    if (typeof window === "undefined") {
        return null;
    }

    return window.sessionStorage;
}

/**
 * Optimized coupon cache utility
 * Caches active coupons with their expiry dates for instant validation
 */
export class CouponCache {
    /**
     * Get cached coupons if valid, otherwise return null
     */
    static get(): Coupon[] | null {
        try {
            const storage = getCouponStorage();
            if (!storage) return null;

            const cached = storage.getItem(CACHE_KEY);
            if (!cached) return null;

            const data: CouponCacheData = JSON.parse(cached);
            const now = Date.now();

            // Check if cache itself has expired
            if (now - data.fetchedAt > CACHE_DURATION) {
                this.clear();
                return null;
            }

            // Filter out expired coupons based on their valid_until date
            const validCoupons = data.coupons.filter(coupon => {
                const expiryDate = new Date(coupon.valid_until).getTime();
                return expiryDate > now;
            });

            // If all coupons expired, clear cache
            if (validCoupons.length === 0 && data.coupons.length > 0) {
                this.clear();
                return null;
            }

            return validCoupons;
        } catch (error) {
            this.clear();
            return null;
        }
    }

    /**
     * Set coupons in cache
     */
    static set(coupons: Coupon[]): void {
        try {
            const storage = getCouponStorage();
            if (!storage) return;

            const data: CouponCacheData = {
                coupons: coupons.map(c => ({ ...c, cachedAt: Date.now() })),
                fetchedAt: Date.now()
            };
            storage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch (error) {
            // Silently fail if storage is unavailable or full.
            logger.warn("Failed to cache coupons:", { err: error });
        }
    }

    /**
     * Find a specific coupon by code (case-insensitive)
     */
    static find(code: string): Coupon | null {
        const coupons = this.get();
        if (!coupons) return null;

        return coupons.find(c => c.code.toUpperCase() === code.toUpperCase()) || null;
    }

    /**
     * Validate if a coupon exists and is still valid
     */
    static validate(code: string, cartTotal: number = 0): {
        valid: boolean;
        coupon?: Coupon;
        error?: string;
    } {
        const coupon = this.find(code);

        if (!coupon) {
            return { valid: false, error: "Coupon not found in cache" };
        }

        const now = new Date();
        const validFrom = new Date(coupon.valid_from);
        const validUntil = new Date(coupon.valid_until);

        // Check if coupon is active
        if (!coupon.is_active) {
            return { valid: false, error: "This coupon is no longer active" };
        }

        // Check date validity
        if (now < validFrom) {
            return { valid: false, error: "This coupon is not yet valid" };
        }

        if (now > validUntil) {
            return { valid: false, error: "This coupon has expired" };
        }

        // Check usage limit
        if (coupon.usage_limit !== undefined && coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
            return { valid: false, error: "This coupon has reached its usage limit" };
        }

        // Check minimum purchase (except for free_delivery)
        if (coupon.type !== 'free_delivery' && coupon.min_purchase_amount && cartTotal < coupon.min_purchase_amount) {
            return {
                valid: false,
                error: `Minimum purchase amount of ₹${coupon.min_purchase_amount} required`
            };
        }

        return { valid: true, coupon };
    }

    /**
     * Clear the cache
     */
    static clear(): void {
        const storage = getCouponStorage();
        if (!storage) return;

        storage.removeItem(CACHE_KEY);
    }

    /**
     * Get time until cache expires (in ms)
     */
    static getTimeUntilExpiry(): number | null {
        try {
            const storage = getCouponStorage();
            if (!storage) return null;

            const cached = storage.getItem(CACHE_KEY);
            if (!cached) return null;

            const data: CouponCacheData = JSON.parse(cached);
            const expiresAt = data.fetchedAt + CACHE_DURATION;
            return Math.max(0, expiresAt - Date.now());
        } catch {
            return null;
        }
    }
}
