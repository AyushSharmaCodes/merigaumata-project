import { Navigate, useLocation } from "react-router-dom";
import { useManagerPermissions } from "@/hooks/useManagerPermissions";
import { Loader2 } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface PermissionProtectedRouteProps {
    permission: string | string[];
    children: React.ReactNode;
}

export function PermissionProtectedRoute({ permission, children }: PermissionProtectedRouteProps) {
    const { t } = useTranslation();
    const { hasPermission, isLoading, isManager } = useManagerPermissions();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground animate-pulse">{t('auth.verifyingPermissions')}</p>
            </div>
        );
    }

    const requiredPermissions = Array.isArray(permission) ? permission : [permission];
    const hasAccess = requiredPermissions.some((permissionKey) => hasPermission(permissionKey));

    // Admins have access to everything, managers need one of the required permissions
    if (!hasAccess) {
        // Find the base path for redirect
        const basePath = location.pathname.startsWith('/manager') ? '/manager' : '/admin';

        return <Navigate to={basePath} replace />;
    }

    return <>{children}</>;
}
