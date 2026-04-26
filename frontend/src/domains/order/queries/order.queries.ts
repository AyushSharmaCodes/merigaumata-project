import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { logger } from "@/core/observability/logger";
import { ordersApi } from "../services/order.service";
import { orderQueryKeys } from "../services/order-utils.service";

interface OrderListParams {
  page?: number;
  limit?: number;
  status?: string;
  payment_status?: string;
  orderNumber?: string;
  startDate?: string;
  endDate?: string;
}

interface AdminOrderListParams extends OrderListParams {
  userId?: string;
  all?: string;
  shallow?: string;
}

interface QueryFallbackOptions {
  enabled?: boolean;
  fallbackToEmpty?: boolean;
}

export function useMyOrders(params?: OrderListParams) {
  return useQuery({
    queryKey: ["orders", "my", params] as const,
    queryFn: () => ordersApi.getMyOrders(params),
  });
}

export function useAdminOrders(params?: AdminOrderListParams) {
  return useQuery({
    queryKey: ["orders", "admin", params] as const,
    queryFn: () => ordersApi.getAll(params),
  });
}

export function useOrder(orderId: string) {
  return useQuery({
    queryKey: orderQueryKeys.detail(orderId),
    queryFn: () => ordersApi.getOrderById(orderId),
    enabled: Boolean(orderId),
  });
}

export function useOrderDetailQuery(orderId?: string) {
  return useQuery({
    queryKey: orderQueryKeys.detail(orderId ?? ""),
    enabled: Boolean(orderId),
    queryFn: () => ordersApi.getOrderDetail(orderId as string),
  });
}

export function useOrderReturnsQuery(orderId?: string, options?: QueryFallbackOptions) {
  return useQuery({
    queryKey: orderQueryKeys.returns(orderId ?? ""),
    enabled: Boolean(orderId) && (options?.enabled ?? true),
    queryFn: async () => {
      try {
        return await ordersApi.getOrderReturns(orderId as string);
      } catch (error) {
        if (options?.fallbackToEmpty) {
          logger.error("Failed to fetch order returns", { err: error, orderId });
          return [];
        }

        throw error;
      }
    },
  });
}

export function useOrderReturnableItemsQuery(orderId?: string, options?: QueryFallbackOptions) {
  return useQuery({
    queryKey: orderQueryKeys.returnableItems(orderId ?? ""),
    enabled: Boolean(orderId) && (options?.enabled ?? false),
    queryFn: async () => {
      try {
        return await ordersApi.getReturnableItems(orderId as string);
      } catch (error) {
        if (options?.fallbackToEmpty) {
          logger.error("Failed to fetch returnable items", { err: error, orderId });
          return [];
        }

        throw error;
      }
    },
  });
}

export function useOrderBaseDetailQuery(orderId?: string) {
  return useQuery({
    queryKey: orderQueryKeys.detail(orderId ?? ""),
    enabled: Boolean(orderId),
    queryFn: () => ordersApi.getOrderById(orderId as string),
  });
}

export function useReturnDetailQuery(returnId?: string) {
  return useQuery({
    queryKey: orderQueryKeys.returnDetail(returnId ?? ""),
    enabled: Boolean(returnId),
    queryFn: () => ordersApi.getReturnDetail(returnId as string),
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      ordersApi.updateStatus(id, status, notes),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.all });
    },
  });
}

export function useUpdateReturnRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action, notes }: { id: string; action: string; notes?: string }) =>
      ordersApi.updateReturnRequestStatus(id, action, notes),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.all });
    },
  });
}

export function useSubmitQCResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ returnItemId, qcData }: { returnItemId: string; qcData: unknown }) =>
      ordersApi.submitQCResult(returnItemId, qcData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.all });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason, comments }: { id: string; reason: string; comments?: string }) =>
      ordersApi.cancelOrder(id, reason, comments),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.all });
    },
  });
}

export function useReturnOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, returnData }: { id: string; returnData: FormData }) =>
      ordersApi.submitReturnRequest(id, returnData),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.all });
    },
  });
}

export function useInvoiceDownloadToken() {
  return useMutation({
    mutationFn: (invoiceId: string) => ordersApi.getInvoiceDownloadToken(invoiceId),
  });
}

export function useRegenerateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => ordersApi.regenerateInvoice(orderId),
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: orderQueryKeys.detail(orderId) });
    },
  });
}
