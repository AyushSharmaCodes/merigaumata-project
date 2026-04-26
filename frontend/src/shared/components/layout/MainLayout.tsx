import { useLocation, Outlet } from "react-router-dom";
import { Navbar } from "@/shared/components/layout/Navbar";
import { Footer } from "@/shared/components/layout/Footer";
import { memo, useMemo } from "react";

export const MainLayoutContent = () => {
  const location = useLocation();
  const isAdminRoute = useMemo(() => location.pathname.startsWith("/admin") || location.pathname.startsWith("/manager"), [location.pathname]);

  return (
    <div className="flex flex-col min-h-screen">
      {!isAdminRoute && <Navbar />}
      <main className="flex-1">
        <Outlet />
      </main>
      {!isAdminRoute && <Footer />}
    </div>
  );
};

export const MainLayout = memo(MainLayoutContent);
