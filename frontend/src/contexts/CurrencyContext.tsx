import { createContext, useContext, useEffect, useMemo } from "react";
import { useCurrencyStore } from "@/store/currencyStore";
import { useAuthStore } from "@/store/authStore";
import type { SupportedCurrency } from "@/types";

interface CurrencyContextValue {
  baseCurrency: string;
  selectedCurrency: string;
  rate: number;
  rates: Record<string, number>;
  provider: string;
  supportedCurrencies: SupportedCurrency[];
  isLoading: boolean;
  setSelectedCurrency: (currency: string) => void;
  convertAmount: (amount: number | null | undefined) => number;
  formatAmount: (amount: number | null | undefined, options?: Intl.NumberFormatOptions) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

/**
 * CurrencyProvider Bridge Component.
 * Orchestrates the useCurrencyStore for legacy Context consumers.
 * DESIGN: Encourages gradual migration to useCurrencyStore(s => s...) for atomic performance.
 */
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const userPreferredCurrency = useAuthStore(state => state.user?.preferredCurrency);
  
  // Store subscriptions - Pull only stable methods and needed state
  const store = useCurrencyStore();
  
  // Sync rates on mount and auth logic
  useEffect(() => {
    // Initial fetch if none cached or stale
    if (store.supportedCurrencies.length === 0) {
      void store.fetchRates(store.selectedCurrency);
    }
  }, []);

  // Sync with user preference when auth settles
  useEffect(() => {
    if (userPreferredCurrency && userPreferredCurrency !== store.selectedCurrency) {
      void store.setSelectedCurrency(userPreferredCurrency, isAuthenticated);
    }
  }, [userPreferredCurrency, isAuthenticated]);

  const value = useMemo<CurrencyContextValue>(() => ({
    baseCurrency: store.baseCurrency,
    selectedCurrency: store.selectedCurrency,
    rate: store.rate,
    rates: store.rates,
    provider: store.provider,
    supportedCurrencies: store.supportedCurrencies,
    isLoading: store.isLoading,
    setSelectedCurrency: (c) => store.setSelectedCurrency(c, isAuthenticated),
    convertAmount: store.convertAmount,
    formatAmount: store.formatAmount
  }), [store, isAuthenticated]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return context;
}
