import { create } from 'zustand';

interface UIState {
  isBlocking: boolean;
  setBlocking: (isBlocking: boolean) => void;
  clearAllBlocking: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isBlocking: false,
  setBlocking: (isBlocking) => set({ isBlocking }),
  clearAllBlocking: () => set({ isBlocking: false }),
}));
