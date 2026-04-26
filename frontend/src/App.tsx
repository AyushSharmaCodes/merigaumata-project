import { BrowserRouter } from "react-router-dom";
import { AppProvider } from "@/app/providers/app-provider";
import { AppRouter } from "@/app/router/routes";
import { AppBootstrap } from "@/app/app-bootstrap";
import { Toaster } from "@/shared/components/ui/toaster";
import { CookieConsent } from "@/shared/components/ui/CookieConsent";
import { ReactivationModal } from "@/shared/components/ui/ReactivationModal";
import { ForceChangePasswordDialog } from "@/shared/components/ui/ForceChangePasswordDialog";
import { ServiceOfflineOverlay } from "@/shared/components/ui/ServiceOfflineOverlay";
import { GlobalLoader } from "@/shared/components/ui/GlobalLoader";

const App = () => {
  return (
    <AppProvider>
      <BrowserRouter
        future={{
          v7_startTransition: false,
          v7_relativeSplatPath: true,
        }}
      >
        <AppBootstrap />
        <GlobalLoader />
        <AppRouter />
        <Toaster />
        <CookieConsent />
        <ReactivationModal />
        <ForceChangePasswordDialog />
        <ServiceOfflineOverlay />
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;
