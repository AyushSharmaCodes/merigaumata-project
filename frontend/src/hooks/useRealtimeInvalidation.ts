import { useEffect, useMemo } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { subscribeToRealtime } from "@/lib/realtime-client";

export function useRealtimeInvalidation(
  topics: string[],
  queryKeys: QueryKey[],
  enabled = true,
) {
  const queryClient = useQueryClient();
  const topicsSignature = JSON.stringify(topics);
  const queryKeysSignature = JSON.stringify(queryKeys);

  const stableTopics = useMemo(() => topics.filter(Boolean), [topicsSignature]);
  const stableQueryKeys = useMemo(() => queryKeys, [queryKeysSignature]);

  useEffect(() => {
    if (!enabled || !stableTopics.length || !stableQueryKeys.length) {
      return;
    }

    const unsubscribe = subscribeToRealtime(stableTopics, () => {
      stableQueryKeys.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });
    });

    return unsubscribe;
  }, [enabled, queryClient, stableQueryKeys, stableTopics]);
}
