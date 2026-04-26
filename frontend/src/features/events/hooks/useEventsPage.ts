import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInfiniteQuery } from "@tanstack/react-query";
import { eventsApi } from "@/domains/content";

export function useEventsPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "all";

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["events", activeTab, i18n.language],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await eventsApi.getAll({
        page: pageParam as number,
        limit: 10,
        status: activeTab,
      });
      return response;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.flatMap((p) => p.events).length;
      if (loadedCount < lastPage.total) {
        return allPages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const allEvents = data?.pages.flatMap((page) => page.events) || [];
  const events = Array.from(new Map(allEvents.map(e => [e.id, e])).values());
  const totalEvents = data?.pages[0]?.total || 0;

  return {
    t,
    i18n,
    activeTab,
    setActiveTab,
    events,
    totalEvents,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  };
}
