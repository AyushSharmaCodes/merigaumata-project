import { create } from "zustand";

interface ProductUiState {
  selectedCategory: string;
  searchQuery: string;
  setSelectedCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  selectedCategory: "all",
  searchQuery: "",
};

export const useProductStore = create<ProductUiState>((set) => ({
  ...INITIAL_STATE,
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  reset: () => set(INITIAL_STATE),
}));
