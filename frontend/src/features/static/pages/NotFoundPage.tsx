import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/button';
import { Home } from 'lucide-react';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6 p-8">
        <div className="space-y-2">
          <h1 className="text-9xl font-bold text-primary">404</h1>
          <h2 className="text-3xl font-semibold text-foreground">{t("notFound.title")}</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t("notFound.desc")}
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/">
            <Home className="mr-2 h-5 w-5" />
            {t("notFound.backHome")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
