import { useQuery } from "@tanstack/react-query";
import { publicContentApi } from "../api/content.api";

export const contentKeys = {
  all: ["content"] as const,
  site: (isAdmin: boolean) => [...contentKeys.all, "site", isAdmin] as const,
  home: ["content", "home"] as const,
  initial: (isAdmin: boolean) => [...contentKeys.all, "initial", isAdmin] as const,
};

export const useSiteContentQuery = (isAdmin = false) =>
  useQuery({
    queryKey: contentKeys.site(isAdmin),
    queryFn: () => publicContentApi.getSiteContent(isAdmin),
  });

export const useHomepageContentQuery = () =>
  useQuery({
    queryKey: contentKeys.home,
    queryFn: () => publicContentApi.getHomepageContent(),
  });

export const useInitialContentPayloadQuery = (isAdmin = false) =>
  useQuery({
    queryKey: contentKeys.initial(isAdmin),
    queryFn: () => publicContentApi.getInitialPayload(isAdmin),
  });
