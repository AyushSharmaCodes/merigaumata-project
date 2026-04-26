import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { blogApi } from "@/domains/content";

export function useBlogPage() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch featured posts (latest 8)
  const { data: featuredPosts = [] } = useQuery({
    queryKey: ["blogs-featured", i18n.language],
    queryFn: () => blogApi.getAll({ published: true, limit: 8 }),
  });

  // Main Paginated/Infinite Search+List
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["blogs-infinite", searchQuery, i18n.language],
    queryFn: ({ pageParam = 1 }) => 
      blogApi.getPaginated(pageParam as number, 10, searchQuery),
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  const paginatedPosts = data?.pages.flatMap((page) => page.blogs) || [];

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleResetSearch = () => {
    setSearchQuery("");
  };

  return {
    t,
    i18n,
    searchQuery,
    featuredPosts,
    paginatedPosts,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    handleSearchChange,
    handleResetSearch,
    fetchNextPage,
  };
}
