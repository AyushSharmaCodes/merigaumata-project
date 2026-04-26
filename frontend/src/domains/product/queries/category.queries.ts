import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoryService } from "../api/category.api";
import type { Category, CategoryType } from "../model/category.types";

export const categoryKeys = {
  all: ["categories"] as const,
  list: (type?: CategoryType) => [...categoryKeys.all, type ?? "all"] as const,
  detail: (id: string) => [...categoryKeys.all, "detail", id] as const,
};

export const useCategoriesQuery = (type?: CategoryType) =>
  useQuery({
    queryKey: categoryKeys.list(type),
    queryFn: () => categoryService.getAll(type),
  });

export const useCategoryQuery = (id: string) =>
  useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: () => categoryService.getById(id),
    enabled: Boolean(id),
  });

export const useCreateCategoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; name_i18n?: Record<string, string>; type: CategoryType }) =>
      categoryService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
};

export const useUpdateCategoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, category }: { id: string; category: Partial<Omit<Category, "id" | "createdAt">> }) =>
      categoryService.update(id, category),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(vars.id) });
    },
  });
};

export const useDeleteCategoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoryService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
};
