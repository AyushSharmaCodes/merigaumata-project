/**
 * Cache Initialization
 * 
 * Import this in your main App.tsx or index.tsx to initialize
 * cache cleanup on page load.
 */

import CacheHelper from './cacheHelper';

/**
 * Initialize cache management
 * Call this once when your app starts (e.g., in App.tsx or main.tsx)
 * 
 * @param clearOnReload - If true, clears cache on page reload (F5, Ctrl+R)
 *                        Default: true (ensures fresh data on explicit reload)
 */
export const initCacheManagement = (clearOnReload = true): void => {
    CacheHelper.initPageReloadHandler(clearOnReload);
};

export default initCacheManagement;
