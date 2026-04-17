import { useEffect, useState } from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/uiStore';

export function GlobalLoader() {
  const { t } = useTranslation();
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progress, setProgress] = useState(0);
  const isUIBlocking = useUIStore(state => state.isBlocking);

  // 1. Fetching/Mutating States with Metadata Awareness
  // Top progress bar tracks overall network activity (excluding silent ones)
  const isFetchingAny = useIsFetching({ predicate: (q) => q.meta?.silent !== true });
  const isMutatingAny = useIsMutating({ predicate: (m) => m.meta?.silent !== true });
  
  // Fullscreen overlay tracks EXPLICIT blocking operations from React Query
  const isFetchingBlocking = useIsFetching({ predicate: (q) => q.meta?.blocking === true });
  const isMutatingBlocking = useIsMutating({ predicate: (m) => m.meta?.blocking === true });

  const isBackgroundLoading = isFetchingAny > 0 || isMutatingAny > 0;
  
  // A "Blocking" state is triggered by transitions, explicit blocking mutations, or UIStore flag
  const isCurrentlyBlocking = isTransitioning || isFetchingBlocking > 0 || isMutatingBlocking > 0 || isUIBlocking;

  // Delayed Blocking State to prevent flicker for fast transitions/requests
  const [showOverlay, setShowOverlay] = useState(false);

  // Handle Route Transitions
  const clearAllBlocking = useUIStore(state => state.clearAllBlocking);

  useEffect(() => {
    setIsTransitioning(true);
    setProgress(30);

    // Fail-safe: Clear manual UI blocking on route change
    // This ensures that if a component calls setBlocking(true) and navigates without clearing it,
    // the UI doesn't remain frozen on the next page.
    if (isUIBlocking) {
      clearAllBlocking();
    }
    
    const transitionTimer = setTimeout(() => {
      setIsTransitioning(false);
      setProgress(100);
    }, 300); // Shorter, more responsive transition

    return () => {
      clearTimeout(transitionTimer);
    };
  }, [location.pathname, isUIBlocking, clearAllBlocking]);

  // Global reset for progress bar
  useEffect(() => {
    if (progress === 100) {
      const resetTimer = setTimeout(() => setProgress(0), 400);
      return () => clearTimeout(resetTimer);
    }
  }, [progress]);

  // Handle Overlay Delay (only show if blocking for > 300ms)
  // Page transitions are NO LONGER part of immediate blocking to keep the UI responsive.
  // The overlay only shows for explicit mutations, manual blocks, or transitions that hang.
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const isActuallyBlocking = isFetchingBlocking > 0 || isMutatingBlocking > 0 || isUIBlocking;
    const shouldShowDelayedOverlay = isTransitioning || isActuallyBlocking;

    if (shouldShowDelayedOverlay) {
      // Delay the overlay to allow fast transitions/requests to finish without blurring the UI
      timer = setTimeout(() => setShowOverlay(true), 300);
    } else {
      setShowOverlay(false);
    }
    return () => clearTimeout(timer);
  }, [isTransitioning, isFetchingBlocking, isMutatingBlocking, isUIBlocking]);

  // Handle Top Progress Bar
  useEffect(() => {
    if ((isBackgroundLoading || isTransitioning) && progress === 0) {
      setProgress(40);
      const interval = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + Math.random() * 5 : prev));
      }, 400);
      return () => clearInterval(interval);
    } else if (!isBackgroundLoading && !isTransitioning) {
      setProgress(100);
      const timeout = setTimeout(() => setProgress(0), 400);
      return () => clearTimeout(timeout);
    }
  }, [isBackgroundLoading, isTransitioning]);

  return (
    <>
      {/* Top Progress Bar - Always shows for any activity */}
      <div 
        className="fixed top-0 left-0 right-0 z-[9999] h-[3px] transition-all duration-300 ease-out pointer-events-none"
        style={{ 
          width: `${progress}%`,
          background: 'linear-gradient(to right, hsl(var(--primary)), hsl(var(--accent)))',
          opacity: progress > 0 && progress < 100 ? 1 : 0
        }}
      />

      {/* Fullscreen Overlay - only show for significant transitions or blocking ops */}
      {showOverlay && (
        <div className={cn(
          "fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-background/40 backdrop-blur-md transition-opacity duration-300",
          (showOverlay && (isTransitioning || isFetchingBlocking > 0 || isMutatingBlocking > 0 || isUIBlocking)) 
            ? "opacity-100 pointer-events-auto" 
            : "opacity-0 pointer-events-none"
        )}>
          <div className="relative flex flex-col items-center gap-6">
            <div className="relative">
              <div className="absolute inset-x-[-20px] inset-y-[-20px] rounded-full bg-primary/20 animate-ping duration-1000" />
              <div className="absolute inset-x-[-10px] inset-y-[-10px] rounded-full bg-primary/10 animate-pulse duration-700" />
              <Loader2 className="h-14 w-14 text-primary animate-spin relative z-10" />
            </div>
            {/* Branding text */}
            <div className="flex flex-col items-center gap-1 animate-in fade-in slide-in-from-bottom-2 duration-700">
              <p className="text-xs font-black text-foreground/40 tracking-[0.3em] uppercase">
                {t("branding.name")}
              </p>
              <p className="text-[10px] font-bold text-primary/60 tracking-[0.1em] uppercase">
                {t("branding.loaderSubtitle")}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
