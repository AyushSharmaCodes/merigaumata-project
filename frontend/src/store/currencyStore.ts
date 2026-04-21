import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { apiClient } from "@/lib/api-client";
import { endpoints } from "@/lib/api";
import { profileService } from "@/services/profile.service";
import { logger } from "@/lib/logger";
import type { CurrencyContextResponse, SupportedCurrency } from "@/types";

interface CurrencyState {
  baseCurrency: string;
  selectedCurrency: string;
  rate: number;
  rates: Record<string, number>;
  supportedCurrencies: SupportedCurrency[];
  isLoading: boolean;
  provider: string;
  
  // Actions
  setSelectedCurrency: (currency: string, isAuthenticated: boolean) => Promise<void>;
  fetchRates: (selectedCurrency?: string | null) => Promise<void>;
  clearSessionCache: () => void;
  convertAmount: (amount: number | null | undefined) => number;
  formatAmount: (amount: number | null | undefined, options?: Intl.NumberFormatOptions) => string;
}

const PREFERENCE_STORAGE_KEY = "preferredCurrency";

const getStoredCurrencyPreference = () => {
  if (typeof window === "undefined") return "INR";
  return localStorage.getItem(PREFERENCE_STORAGE_KEY)?.toUpperCase() || "INR";
};

const getSessionStorage = () => {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.sessionStorage;
};

/**
 * High-performance Currency Store.
 * Replaces the monolithic CurrencyContext to provide atomic subscriptions.
 * Prevents "Re-render Cascades" when currency rates are updated in the background.
 */
export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      baseCurrency: "INR",
      selectedCurrency: getStoredCurrencyPreference(),
      rate: 1,
      rates: { "INR": 1 },
      supportedCurrencies: [],
      isLoading: false,
      provider: "base",

      fetchRates: async (selectedCurrencyOverride) => {
        const { selectedCurrency } = get();
        const activeCurrency = selectedCurrencyOverride || selectedCurrency;
        
        set({ isLoading: true });
        try {
          const response = await apiClient.get(endpoints.getCurrencyContext, {
            headers: activeCurrency ? { "x-user-currency": activeCurrency } : undefined
          });
          const data: CurrencyContextResponse = response.data;

          const base = data.base_currency || "INR";
          const display = data.display_currency || activeCurrency || base;
          const rates = data.rates || { [base]: 1 };
          const rate = Number(rates[display]) || data.rate || 1;

          set({
            baseCurrency: base,
            selectedCurrency: display,
            rates,
            rate,
            supportedCurrencies: data.supported_currencies || [],
            provider: data.provider || "api",
            isLoading: false
          });
        } catch (error) {
          logger.error("Failed to fetch currency rates", error);
          set({ isLoading: false });
        }
      },

      setSelectedCurrency: async (currency, isAuthenticated) => {
        const normalized = currency.toUpperCase();
        set({ selectedCurrency: normalized });
        localStorage.setItem(PREFERENCE_STORAGE_KEY, normalized);

        if (isAuthenticated) {
          try {
            await profileService.updatePreferences({ currency: normalized });
          } catch (error) {
            logger.warn("Failed to persist currency preference", { error, currency: normalized });
          }
        }
        
        // Refetch rates for the new currency
        await get().fetchRates(normalized);
      },

      clearSessionCache: () => {
        set({
          baseCurrency: "INR",
          selectedCurrency: getStoredCurrencyPreference(),
          rate: 1,
          rates: { INR: 1 },
          supportedCurrencies: [],
          isLoading: false,
          provider: "base",
        });
      },

      convertAmount: (amount) => {
        const { rate } = get();
        const numericAmount = Number(amount || 0);
        return Math.round(numericAmount * rate * 100) / 100;
      },

      formatAmount: (amount, options = {}) => {
        const { rate, selectedCurrency } = get();
        const numericAmount = Number(amount || 0);
        const converted = Math.round(numericAmount * rate * 100) / 100;
        
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: selectedCurrency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          ...options
        }).format(converted);
      }
    }),
    {
      name: "currency-storage",
      storage: createJSONStorage(getSessionStorage),
      partialize: (state) => ({ 
        baseCurrency: state.baseCurrency,
        selectedCurrency: state.selectedCurrency,
        rates: state.rates,
        rate: state.rate,
        supportedCurrencies: state.supportedCurrencies,
        provider: state.provider
      }),
    }
  )
);
