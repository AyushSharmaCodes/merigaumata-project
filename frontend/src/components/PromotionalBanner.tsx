import { logger } from "@/lib/logger";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Tag, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Coupon } from "@/types";
import { couponService } from "@/services/coupon.service";
import { useCurrency } from "@/contexts/CurrencyContext";

export function PromotionalBanner() {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [isHovered, setIsHovered] = useState(false);
    const marqueeRef = useRef<HTMLDivElement>(null);
    const positionRef = useRef(0);

    // Smooth JS animation loop
    useEffect(() => {
        if (loading || coupons.length === 0) return;

        let lastTime = performance.now();
        let animationFrameId: number;

        const animate = (time: number) => {
            const delta = time - lastTime;
            lastTime = time;

            // Speed in pixels per millisecond
            // baseline: approx 0.05-0.1 depending on content width
            const speed = isHovered ? 0.02 : 0.08; 
            positionRef.current -= speed * delta;

            if (marqueeRef.current) {
                const totalWidth = marqueeRef.current.scrollWidth;
                const setWidth = totalWidth / 3; // We have 3 copies (...coupons, ...coupons, ...coupons)
                
                if (positionRef.current <= -setWidth) {
                    positionRef.current += setWidth;
                }
                
                marqueeRef.current.style.transform = `translateX(${positionRef.current}px)`;
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [loading, coupons.length, isHovered]);

    useEffect(() => {
        fetchActiveCoupons();

        const validityInterval = setInterval(fetchActiveCoupons, 5 * 60 * 1000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                fetchActiveCoupons();
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

    const fetchActiveCoupons = async () => {
        try {
            const data = await couponService.getActive();
            logger.info("PromotionalBanner: Fetched coupons", { count: data.length });
            setCoupons(data);
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
    const marqueeItems = [...coupons, ...coupons, ...coupons];

    return (
        <div className="relative w-full z-[60] bg-[#2C1810] text-white border-b border-[#B85C3C]/30 h-10 overflow-hidden flex items-center">
            <style dangerouslySetInnerHTML={{
                __html: `
                .animate-marquee-container {
                    display: inline-flex;
                    white-space: nowrap;
                    will-change: transform;
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
                    <div 
                        ref={marqueeRef}
                        className="animate-marquee-container"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                    >
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
                                        Min: {formatAmount(coupon.min_purchase_amount)}
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
