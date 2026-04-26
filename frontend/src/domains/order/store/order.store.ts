import { create } from "zustand";

interface OrderStoreState {
  activeOrderId: string | null;
  setActiveOrderId: (orderId: string | null) => void;
}

export const useOrderStore = create<OrderStoreState>((set) => ({
  activeOrderId: null,
  setActiveOrderId: (activeOrderId) => set({ activeOrderId }),
}));
