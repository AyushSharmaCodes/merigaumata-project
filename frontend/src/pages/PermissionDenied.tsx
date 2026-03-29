import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Home, LayoutDashboard } from 'lucide-react';

export default function PermissionDenied() {
  const { t } = useTranslation();
  const location = useLocation();
  
  // Try to get where they came from to determine the correct dashboard link
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '';
  
  // Deterministic dashboard path based on current URL or 'from' state
  let dashboardPath = '/';
  const currentPath = location.pathname;
  
  if (from.startsWith('/manager') || currentPath.startsWith('/manager')) {
    dashboardPath = '/manager';
  } else if (from.startsWith('/admin') || currentPath.startsWith('/admin')) {
    dashboardPath = '/admin';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-8 p-8 max-w-md animate-in fade-in zoom-in duration-500">
        <div className="flex justify-center">
          <div className="p-6 bg-destructive/10 rounded-full animate-bounce-subtle">
            <ShieldAlert className="h-20 w-20 text-destructive" />
          </div>
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            {t("permissionDenied.title")}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {t("permissionDenied.desc")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button asChild variant="outline" size="lg" className="rounded-full px-8">
            <Link to="/">
              <Home className="mr-2 h-5 w-5" />
              {t("permissionDenied.backHome")}
            </Link>
          </Button>
          {dashboardPath !== '/' && (
            <Button asChild size="lg" className="rounded-full px-8 shadow-lg hover:shadow-xl transition-all duration-300">
              <Link to={dashboardPath}>
                <LayoutDashboard className="mr-2 h-5 w-5" />
                {t("permissionDenied.backToDashboard")}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
