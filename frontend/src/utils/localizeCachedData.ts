import type { QueryClient } from "@tanstack/react-query";

function localizeCachedData<T>(data: T, lang: string): T {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data.map((item) => localizeCachedData(item, lang)) as T;
  }

  if (typeof data !== "object" || data === null || data instanceof Date) {
    return data;
  }

  const result: Record<string, unknown> = { ...(data as Record<string, unknown>) };

  for (const key of Object.keys(result)) {
    const value = result[key];

    if (key.endsWith("_i18n") && value) {
      const baseField = key.replace(/_i18n$/, "");
      let translations = value as Record<string, unknown>;

      if (typeof value === "string") {
        try {
          translations = JSON.parse(value) as Record<string, unknown>;
        } catch {
          translations = {};
        }
      }

      if (translations && typeof translations === "object") {
        if (translations[lang] !== undefined) {
          result[baseField] = translations[lang];
        } else if (translations.en !== undefined) {
          result[baseField] = translations.en;
        }
      }

      continue;
    }

    if (typeof value === "object" && value !== null) {
      result[key] = localizeCachedData(value, lang);
    }
  }

  return result as T;
}

function localizeAllCachedQueries(queryClient: QueryClient, lang: string) {
  const queries = queryClient.getQueryCache().getAll();

  queries.forEach((query) => {
    queryClient.setQueryData(query.queryKey, (existingData: unknown) =>
      localizeCachedData(existingData, lang)
    );
  });
}

export { localizeCachedData, localizeAllCachedQueries };
