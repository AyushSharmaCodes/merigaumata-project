import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Hammer, CloudOff, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { setMaintenanceLock, apiClient } from "@/lib/api-client";
import { CONFIG } from "@/config";

interface OfflineEventDetail {
    isMaintenance?: boolean;
    retryAfter?: number;
}

/**
 * ServiceOfflineOverlay
 * 
 * A premium, full-screen overlay that appears when the server returns a 503 (Maintenance)
 * or when a critical network failure occurs. It listens for the 'app:server-offline' 
 * custom event dispatched by the API client.
 */
export function ServiceOfflineOverlay() {
    const { t } = useTranslation();
    const [isVisible, setIsVisible] = useState(false);
    const [isMaintenance, setIsMaintenance] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);

    useEffect(() => {
        const handleOffline = (event: CustomEvent<OfflineEventDetail>) => {
            const { isMaintenance: maintenance } = event.detail || {};
            setIsMaintenance(!!maintenance);
            if (!!maintenance) {
                setMaintenanceLock(true);
            }
            setIsVisible(true);
        };

        const handleOnline = () => {
            // We only hide if it was a network error, not if it's maintenance mode
            if (!isMaintenance) {
                setIsVisible(false);
            }
        };

        window.addEventListener('app:server-offline' as any, handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('app:server-offline' as any, handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, [isMaintenance]);

    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            // Only retry if it's a server crash/network error
            if (!isMaintenance) {
                const response = await apiClient.get('/health/live');
                if (response.status === 200) {
                    setMaintenanceLock(false);
                    setIsVisible(false);
                    // Optional: window.location.reload(); 
                    // Better to just let the app resume if it's a SPA
                    return;
                }
            }
            
            // If still maintenance or health check failed
            setTimeout(() => {
                setIsRetrying(false);
            }, 1000);
        } catch (error) {
            console.error('[ServiceOfflineOverlay] Retry health check failed', error);
            setTimeout(() => {
                setIsRetrying(false);
            }, 1000);
        }
    };

    const handleContactSupport = () => {
        if (isMaintenance) {
            window.location.href = `mailto:${CONFIG.SUPPORT_EMAIL}`;
        } else {
            window.open('https://merigaumata.com/contact', '_blank');
        }
    };

    if (!isVisible) return null;

    const content = (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-background/40 backdrop-blur-2xl animate-in fade-in duration-700">
            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-[#B85C3C]/20 rounded-full blur-[120px] animate-pulse duration-5000" />
            </div>

            <div className="relative max-w-lg w-full mx-6 p-10 rounded-[2.5rem] bg-white/80 border border-white/50 shadow-[0_32px_64px_-16px_rgba(44,24,16,0.1)] text-center animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                {/* Icon Container */}
                <div className="mx-auto mb-8 w-24 h-24 rounded-3xl bg-gradient-to-br from-[#B85C3C]/10 to-[#B85C3C]/5 flex items-center justify-center relative">
                    <div className="absolute inset-0 rounded-3xl bg-primary/5 animate-ping opacity-20" />
                    {isMaintenance ? (
                        <Hammer className="w-12 h-12 text-[#B85C3C] animate-bounce duration-2000" />
                    ) : (
                        <CloudOff className="w-12 h-12 text-[#B85C3C] animate-pulse" />
                    )}
                </div>

                {/* Text Content */}
                <h1 className="text-3xl font-black text-[#2C1810] mb-4 tracking-tight">
                    {isMaintenance 
                        ? (t("common.maintenance.title") || "Under Maintenance") 
                        : (t("common.offline.title") || "Connection Lost")}
                </h1>
                
                <p className="text-[#2C1810]/60 text-lg leading-relaxed mb-10 max-w-sm mx-auto">
                    {isMaintenance 
                        ? (t("common.maintenance.description") || "We're currently making some improvements to enhance your experience. We'll be back shortly.") 
                        : (t("common.offline.description") || "We're having trouble connecting to the server. Please check your internet connection.")}
                </p>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                    {!isMaintenance && (
                        <Button 
                            size="lg" 
                            onClick={handleRetry}
                            disabled={isRetrying}
                            className="rounded-2xl h-14 px-8 bg-[#B85C3C] hover:bg-[#A04D30] text-white font-bold shadow-lg shadow-[#B85C3C]/20 transition-all hover:scale-105 active:scale-95 min-w-[180px]"
                        >
                            {isRetrying ? (
                                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <RefreshCw className="mr-2 h-5 w-5" />
                            )}
                            {t("common.actionsShort.retry") || "Try Again"}
                        </Button>
                    )}
                    
                    <Button 
                        variant="outline" 
                        size="lg"
                        className="rounded-2xl h-14 px-8 border-[#2C1810]/10 text-[#2C1810] font-bold hover:bg-[#2C1810]/5 transition-all"
                        onClick={handleContactSupport}
                    >
                        {t("common.actionsShort.support") || "Contact Support"}
                    </Button>
                </div>

                {/* Footer status */}
                <div className="mt-12 pt-8 border-t border-[#2C1810]/5 flex items-center justify-center gap-6">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#2C1810]/40 uppercase tracking-widest">
                        <Smartphone className="w-4 h-4" />
                        App Version {CONFIG.APP_VERSION}
                    </div>
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
