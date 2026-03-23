import { QueryClient } from "@tanstack/react-query";

/**
 * Optimized QueryClient configuration
 * 
 * Key settings:
 * - staleTime: 30 seconds - shorter for more responsive UI updates
 * - gcTime: 5 minutes - keeps unused data in cache for quick restoration
 * - refetchOnWindowFocus: enabled - refetch when user returns to tab for fresh data
 * - refetchOnMount: 'always' only if stale - uses cached data when available
 * - retry: 1 - single retry on failure to avoid hammering failing endpoints
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30 * 1000,              // 30 seconds - ensures mutations trigger immediate refetch
            gcTime: 5 * 60 * 1000,             // 5 minutes cache retention
            refetchOnWindowFocus: true,        // Refetch when user focuses window for fresh data
            refetchOnReconnect: 'always',      // Refetch when reconnecting to network
            retry: 1,                          // Only 1 retry on failure
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
        },
        mutations: {
            retry: 0,                          // No retries for mutations (user should retry)
        },
    },
});

