import { create } from "zustand";

interface UserUiState {
  profileTab: "account" | "events" | "donations";
  setProfileTab: (tab: "account" | "events" | "donations") => void;
}

export const useUserStore = create<UserUiState>((set) => ({
  profileTab: "account",
  setProfileTab: (profileTab) => set({ profileTab }),
}));
