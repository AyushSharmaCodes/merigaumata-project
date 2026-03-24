import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { endpoints } from "@/lib/api";
import type { CurrencyContextResponse, SupportedCurrency } from "@/types";

const STORAGE_KEY = "preferredCurrency";
const SNAPSHOT_KEY = "currencyContextSnapshot";
const SNAPSHOT_TTL = 24 * 60 * 60 * 1000;

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

function getInitialCurrency() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY)?.toUpperCase() || null;
}

function getStoredSnapshot(): CurrencyContextResponse | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CurrencyContextResponse & { saved_at?: number };
    if (!parsed?.saved_at) return null;
    if (parsed.saved_at + SNAPSHOT_TTL <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [selectedCurrency, setSelectedCurrencyState] = useState<string | null>(getInitialCurrency);
  const [snapshot, setSnapshot] = useState<CurrencyContextResponse | null>(getStoredSnapshot);

  const { data, isLoading } = useQuery<CurrencyContextResponse>({
    queryKey: ["currencyContext", selectedCurrency],
    queryFn: async () => {
      const response = await apiClient.get(endpoints.getCurrencyContext, {
        headers: selectedCurrency ? { "x-user-currency": selectedCurrency } : undefined
      });
      return response.data;
    },
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    placeholderData: snapshot || undefined,
    refetchOnMount: "always"
  });

  useEffect(() => {
    if (!data?.display_currency) return;
    setSelectedCurrencyState(data.display_currency);
    localStorage.setItem(STORAGE_KEY, data.display_currency);
    setSnapshot(data);
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      ...data,
      saved_at: Date.now()
    }));
  }, [data?.display_currency]);

  const value = useMemo<CurrencyContextValue>(() => {
    const activeData = data || snapshot;
    const baseCurrency = activeData?.base_currency || "INR";
    const activeCurrency = selectedCurrency || activeData?.display_currency || baseCurrency;
    const rates = activeData?.rates || { [baseCurrency]: 1 };
    const rate = Number(rates[activeCurrency]) || activeData?.rate || (activeCurrency === baseCurrency ? 1 : 1);

    return {
      baseCurrency,
      selectedCurrency: activeCurrency,
      rate,
      rates,
      provider: activeData?.provider || "base",
      supportedCurrencies: activeData?.supported_currencies || [],
      isLoading: isLoading && !activeData,
      setSelectedCurrency: (currency: string) => {
        const normalized = currency.toUpperCase();
        setSelectedCurrencyState(normalized);
        localStorage.setItem(STORAGE_KEY, normalized);
      },
      convertAmount: (amount) => {
        const numericAmount = Number(amount || 0);
        return Math.round(numericAmount * rate * 100) / 100;
      },
      formatAmount: (amount, options = {}) => {
        const numericAmount = Number(amount || 0);
        const converted = Math.round(numericAmount * rate * 100) / 100;
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: activeCurrency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          ...options
        }).format(converted);
      }
    };
  }, [data, snapshot, isLoading, selectedCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return context;
}
