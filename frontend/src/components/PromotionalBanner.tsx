import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Tag, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Coupon } from "@/types";
import { couponService } from "@/services/coupon.service";

export function PromotionalBanner() {
    const { t } = useTranslation();
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Force fetch on mount to ensure fresh data on reload
        fetchActiveCoupons();

        // Then poll periodically
        const validityInterval = setInterval(checkAndFetchCoupons, 30000); // Poll every 30 seconds

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                checkAndFetchCoupons();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            clearInterval(validityInterval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    // Add/remove class to body when banner visibility changes
    useEffect(() => {
        const hasActiveCoupons = !loading && coupons.length > 0;
        if (hasActiveCoupons) {
            document.body.classList.add('has-promo-banner');
        } else {
            document.body.classList.remove('has-promo-banner');
        }

        return () => {
            document.body.classList.remove('has-promo-banner');
        };
    }, [loading, coupons.length]);

    const checkAndFetchCoupons = async () => {
        const cacheKey = "promo_coupons_cache";
        const cacheVersion = "v3"; // Bumped version to v3
        const cacheDuration = 60 * 1000; // 1 minute cache for faster updates

        try {
            const cachedData = localStorage.getItem(cacheKey);

            if (cachedData) {
                const { coupons: cachedCoupons, timestamp, version } = JSON.parse(cachedData);
                const isExpired = Date.now() - timestamp > cacheDuration;
                const isOldVersion = version !== cacheVersion;

                if (!isExpired && !isOldVersion && cachedCoupons.length > 0) {
                    logger.debug("PromotionalBanner: Using cached coupons", { count: cachedCoupons.length });
                    setCoupons(cachedCoupons);
                    setLoading(false);
                    return;
                }
            }

            fetchActiveCoupons();
        } catch (error) {
            logger.error("PromotionalBanner: Cache error", error);
            fetchActiveCoupons();
        }
    };

    const fetchActiveCoupons = async () => {
        try {
            const data = await couponService.getActive();
            logger.info("PromotionalBanner: Fetched coupons", { count: data.length });
            setCoupons(data);

            localStorage.setItem("promo_coupons_cache", JSON.stringify({
                coupons: data,
                timestamp: Date.now(),
                version: "v3" // Updated version
            }));
        } catch (error) {
            logger.error("PromotionalBanner: API Error", error);
        } finally {
            setLoading(false);
        }
    };

    const getCouponDescription = (coupon: Coupon) => {
        if (coupon.target_name) {
            return coupon.target_name;
        }

        if (coupon.type === "cart") {
            return t("hero.promo.sitewideDiscount");
        } else if (coupon.type === "category") {
            return t("hero.promo.categorySpecial", { category: coupon.target_id || 'Category' });
        } else if (coupon.type === "product") {
            return t("hero.promo.productDeal");
        } else if (coupon.type === "variant") {
            return t("hero.promo.exclusiveOffer");
        } else if (coupon.type === "free_delivery") {
            return t("hero.promo.freeShipping");
        }
        return t("hero.promo.limitedOffer");
    };

    if (loading || coupons.length === 0) return null;

    // Duplicate coupons to ensure smooth marquee loop - using 6 copies for safety with few items
    const marqueeItems = [...coupons, ...coupons, ...coupons, ...coupons, ...coupons, ...coupons];

    return (
        <div className="relative w-full z-[60] bg-[#2C1810] text-white border-b border-[#B85C3C]/30 h-10 overflow-hidden flex items-center">
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee-container {
                    display: inline-flex;
                    white-space: nowrap;
                    animation: marquee 120s linear infinite;
                    will-change: transform;
                }
                .animate-marquee-container:hover {
                    animation-play-state: paused;
                }
                .coupon-item {
                    display: flex;
                    align-items: center;
                    flex-shrink: 0;
                    margin-right: 4rem; /* 64px gap replacement for tailwind gap in style block */
                }
            `}} />

            <div className="relative flex items-center w-full px-4 overflow-hidden group h-full">
                {/* Fixed Label to the left */}
                <div className="flex-shrink-0 flex items-center gap-2 bg-[#2C1810] pr-6 border-r border-white/10 z-10 shadow-[20px_0_30px_-5px_#2C1810] h-full">
                    <Sparkles className="h-4 w-4 text-[#B85C3C] animate-pulse" />
                    <span className="font-bold text-[10px] uppercase tracking-[0.2em] text-[#B85C3C]">{t("hero.promo.exclusiveOffers")}</span>
                </div>

                {/* Marquee Container */}
                <div className="flex-1 overflow-hidden h-full flex items-center">
                    <div className="animate-marquee-container">
                        {marqueeItems.map((coupon, idx) => (
                            <div key={`${coupon.id}-${idx}`} className="coupon-item gap-8 group cursor-default">
                                <div className="flex items-center gap-2">
                                    <Tag className="h-4 w-4 text-white/40 group-hover:text-[#B85C3C] transition-colors" />
                                    <span className="font-medium text-xs tracking-wider uppercase">
                                        {getCouponDescription(coupon)}:
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="text-[10px] py-0.5 px-2 border-white/20 text-white font-mono h-6 flex items-center">
                                        {coupon.code}
                                    </Badge>
                                    <span className="font-black text-xs text-[#B85C3C]">
                                        {coupon.type === 'free_delivery' ? t("hero.promo.freeShipping") : (coupon.discount_percentage ? `${coupon.discount_percentage}% OFF` : t("hero.promo.specialOffer"))}
                                    </span>
                                </div>
                                {typeof coupon.min_purchase_amount === 'number' && coupon.min_purchase_amount > 0 && (
                                    <span className="text-[10px] text-white/90 font-bold bg-white/10 px-1.5 py-0.5 rounded-full">
                                        Min: ₹{coupon.min_purchase_amount}
                                    </span>
                                )}
                                <div className="flex items-center gap-4 ml-4 opacity-20">
                                    <div className="h-4 w-[1px] bg-white" />
                                    <Sparkles className="h-3 w-3 text-[#B85C3C]" />
                                    <div className="h-4 w-[1px] bg-white" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Fixed Action to the right */}
                <div className="flex-shrink-0 flex items-center gap-2 bg-[#2C1810] pl-6 border-l border-white/10 z-10 shadow-[-20px_0_30px_-5px_#2C1810] hidden md:flex">
                    <span className="text-[10px] font-medium uppercase tracking-widest text-white/60">{t("hero.promo.limitedTime")}</span>
                </div>
            </div>
        </div>
    );
}
