import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cartApi } from "../api/cart.api";

export const cartKeys = {
  all: ["cart"] as const,
  coupons: ["cart", "coupons"] as const,
};

export const useCartQuery = () =>
  useQuery({
    queryKey: cartKeys.all,
    queryFn: () => cartApi.getCart(),
  });

export const useCartCouponsQuery = () =>
  useQuery({
    queryKey: cartKeys.coupons,
    queryFn: () => cartApi.getCoupons(),
  });

export const useApplyCartCouponMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => cartApi.applyCoupon(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
};

export const useRemoveCartCouponMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cartApi.removeCoupon(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
    },
  });
};
