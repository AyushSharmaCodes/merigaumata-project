import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { productApi } from "../api/product.api";
import { Product } from "../model/product.types";

export const productKeys = {
  all: ["products"] as const,
  lists: () => [...productKeys.all, "list"] as const,
  list: (filters: Record<string, any>) => [...productKeys.lists(), { filters }] as const,
  details: () => [...productKeys.all, "detail"] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};

export const useProductsQuery = (params?: any) => {
  return useQuery({
    queryKey: productKeys.list(params || {}),
    queryFn: () => productApi.getAll(params),
  });
};

export const useInfiniteProductsQuery = (params: any) => {
  return useInfiniteQuery({
    queryKey: [...productKeys.lists(), params],
    queryFn: ({ pageParam = 1 }) => productApi.getAll({ ...params, page: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      const loadedProducts = allPages.flatMap((p) => p.products).length;
      if (loadedProducts < lastPage.total) {
        return allPages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });
};

export const useProductDetailQuery = (id: string, params?: any, options?: any) => {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productApi.getById(id, params),
    enabled: !!id,
    ...options,
  });
};

export const useCreateProductMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Product, "id">) => productApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: ["admin-products-stats"] });
    },
  });
};

export const useUpdateProductMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; product: Partial<Product> }) => productApi.update(data.id, data.product),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ["admin-products-stats"] });
    },
  });
};

export const useDeleteProductMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: ["admin-products-stats"] });
    },
  });
};

export const useCreateProductWithVariantsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { product: any; variants: any[] }) => productApi.createWithVariants(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: ["admin-products-stats"] });
    },
  });
};

export const useUpdateProductWithVariantsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; payload: { product?: any; variants?: any[] } }) => productApi.updateWithVariants(data.id, data.payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: ["admin-products-stats"] });
    },
  });
};
