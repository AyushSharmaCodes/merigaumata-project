// Track if we're already loading to prevent duplicate script tags
import { logger } from "@/core/observability/logger";

let isLoading = false;
let loadPromise: Promise<boolean> | null = null;

// Singleton reference for the DOM fix cleanup function
let domFixCleanup: (() => void) | null = null;
let domFixActive = false;

/**
 * Production-grade Razorpay DOM fix
 * Fixes two critical issues:
 * 1. Accessibility: Removes aria-hidden from the container
 * 2. Cross-browser: Adds allow="otp-credentials" to the iframe
 * 
 * This is a singleton implementation with robust error handling.
 * Safe to call multiple times - will return existing cleanup if already active.
 */
export const fixRazorpayDOM = (): (() => void) => {
    // If already running, return the existing cleanup
    if (domFixActive && domFixCleanup) {
        logger.debug("Razorpay DOM fix already active");
        return domFixCleanup;
    }

    logger.debug("Initializing Razorpay DOM fix");
    domFixActive = true;

    let mainObserver: MutationObserver | null = null;
    let containerObserver: MutationObserver | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    const fixIframe = (iframe: HTMLIFrameElement): void => {
        try {
            const currentAllow = iframe.getAttribute('allow') || '';
            if (!currentAllow.includes('otp-credentials')) {
                const separator = currentAllow && !currentAllow.endsWith(';') ? '; ' : '';
                iframe.setAttribute('allow', `${currentAllow}${separator}otp-credentials`);
                logger.debug("Applied otp-credentials to Razorpay iframe");
            }
        } catch (error) {
            logger.error("Error fixing Razorpay iframe:", error);
        }
    };

    const handleContainer = (container: HTMLElement): void => {
        try {
            // 1. Remove aria-hidden immediately
            if (container.getAttribute('aria-hidden') === 'true') {
                container.removeAttribute('aria-hidden');
                logger.debug("Removed aria-hidden from Razorpay container");
            }

            // 2. Find and fix iframe immediately
            const iframe = container.querySelector('iframe');
            if (iframe) {
                fixIframe(iframe);
            } else {
                // Watch for iframe being added later
                if (containerObserver) {
                    containerObserver.disconnect();
                }
                containerObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList') {
                            mutation.addedNodes.forEach((node) => {
                                if (node instanceof HTMLIFrameElement) {
                                    fixIframe(node);
                                }
                            });
                        }
                    });
                });
                containerObserver.observe(container, { childList: true, subtree: true });
            }

            // 3. Keep observing this container for attribute changes
            if (mainObserver) {
                mainObserver.observe(container, { attributes: true, attributeFilter: ['aria-hidden'] });
            }
        } catch (error) {
            logger.error("Error handling Razorpay container:", error);
        }
    };

    // Main observer for detecting container and attribute changes
    try {
        mainObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                try {
                    // Check for container addition to body
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node instanceof HTMLElement && node.classList.contains('razorpay-container')) {
                                handleContainer(node);
                            }
                        });
                    }

                    // Check for attribute changes on container (aria-hidden)
                    if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
                        const target = mutation.target as HTMLElement;
                        if (target.getAttribute('aria-hidden') === 'true') {
                            target.removeAttribute('aria-hidden');
                        }
                    }
                } catch (error) {
                    logger.error("Error in Razorpay mutation observer:", error);
                }
            });
        });

        // Start observing document body for the container
        mainObserver.observe(document.body, { childList: true, subtree: false });

        // Also check immediately in case it's already there
        const existingContainer = document.querySelector('.razorpay-container') as HTMLElement;
        if (existingContainer) {
            handleContainer(existingContainer);
        }

        // Polling backup (catches edge cases where MutationObserver might miss)
        intervalId = setInterval(() => {
            try {
                const container = document.querySelector('.razorpay-container') as HTMLElement;
                if (container) {
                    if (container.getAttribute('aria-hidden') === 'true') {
                        container.removeAttribute('aria-hidden');
                    }
                    const iframe = container.querySelector('iframe');
                    if (iframe) {
                        fixIframe(iframe);
                    }
                }
            } catch (error) {
                logger.error("Error in Razorpay polling backup:", error);
            }
        }, 500);

        logger.debug("Razorpay DOM fix initialized successfully");
    } catch (error) {
        logger.error("Failed to initialize Razorpay DOM fix:", error);
    }

    // Store cleanup function
    domFixCleanup = () => {
        try {
            if (mainObserver) {
                mainObserver.disconnect();
                mainObserver = null;
            }
            if (containerObserver) {
                containerObserver.disconnect();
                containerObserver = null;
            }
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            domFixActive = false;
            domFixCleanup = null;
            logger.debug("Razorpay DOM fix cleaned up");
        } catch (error) {
            logger.error("Error cleaning up Razorpay DOM fix:", error);
        }
    };

    return domFixCleanup;
};

/**
 * Load Razorpay SDK
 * Automatically initializes DOM fix when loaded
 */
export const loadRazorpay = (): Promise<boolean> => {
    // Return existing promise if already loading
    if (isLoading && loadPromise) {
        return loadPromise;
    }

    // Check if already loaded
    if (window.Razorpay) {
        // Ensure DOM fix is active even if loaded previously
        fixRazorpayDOM();
        return Promise.resolve(true);
    }

    isLoading = true;
    loadPromise = new Promise((resolve) => {
        try {
            const script = document.createElement("script");
            script.src = import.meta.env.VITE_RAZORPAY_CHECKOUT_URL;
            script.async = true;

            script.onload = () => {
                isLoading = false;
                logger.debug("Razorpay SDK loaded successfully");
                // Start DOM fix immediately after load
                fixRazorpayDOM();
                resolve(true);
            };

            script.onerror = () => {
                logger.error("Failed to load Razorpay SDK");
                isLoading = false;
                resolve(false);
            };

            document.body.appendChild(script);

            // Also start DOM fix immediately when we inject the script
            // This catches any iframes created during script execution/initialization
            fixRazorpayDOM();
        } catch (error) {
            logger.error("Error loading Razorpay SDK:", error);
            isLoading = false;
            resolve(false);
        }
    });

    return loadPromise;
};

/**
 * Prefetch Razorpay SDK in the background without blocking
 * Call this on pages where payment might be initiated (e.g., cart, checkout)
 */
export const prefetchRazorpay = (): void => {
    if (!window.Razorpay && !isLoading) {
        loadRazorpay().catch((error) => {
            logger.debug("Razorpay prefetch failed (will retry when needed):", error);
        });
    }
};
