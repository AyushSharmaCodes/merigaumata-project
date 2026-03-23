import { logger } from "@/lib/logger";
import { useState, useEffect } from 'react';

interface CacheItem<T> {
    data: T;
    expiry: number;
}

interface UseCachedDataResult<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
}

/**
 * Hook to fetch data with localStorage caching
 * @param key Unique key for the cache
 * @param fetcher Async function to fetch data if cache is missing/expired
 * @param ttlMs Time to live in milliseconds (default: 5 minutes)
 */
export function useCachedData<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 5 * 60 * 1000
): UseCachedDataResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const loadData = async (force: boolean = false) => {
        setLoading(true);
        setError(null);

        try {
            // 1. Check LocalStorage Cache
            if (!force) {
                const cached = localStorage.getItem(key);
                if (cached) {
                    try {
                        const parsed: CacheItem<T> = JSON.parse(cached);
                        if (parsed.expiry > Date.now()) {
                            setData(parsed.data);
                            setLoading(false);
                            return;
                        }
                    } catch (e) {
                        logger.warn('Failed to parse cached data', { module: 'useCachedData', key, err: e });
                        localStorage.removeItem(key);
                    }
                }
            }

            // 2. Fetch from API
            const remoteData = await fetcher();

            // 3. Update State
            setData(remoteData);

            // 4. Update Cache
            try {
                const cacheItem: CacheItem<T> = {
                    data: remoteData,
                    expiry: Date.now() + ttlMs
                };
                localStorage.setItem(key, JSON.stringify(cacheItem));
            } catch (e) {
                logger.warn('Failed to save to localStorage', { module: 'useCachedData', key, err: e });
            }

        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]); // Re-run if key changes

    return { data, loading, error, refetch: () => loadData(true) };
}
