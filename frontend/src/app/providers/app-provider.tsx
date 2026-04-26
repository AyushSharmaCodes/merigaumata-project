import { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/app/i18n/config";
import { CurrencyProvider } from "@/app/providers/currency-provider";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { QueryProvider } from "./query-provider";
import { ErrorBoundary } from "@/shared/components/ui/ErrorBoundary";

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <I18nextProvider i18n={i18n}>
          <CurrencyProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </CurrencyProvider>
        </I18nextProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
};
