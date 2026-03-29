import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { managerService } from "@/services/manager.service";

export function useManagerPermissions() {
    const { user } = useAuthStore();
    const isManager = user?.role === "manager";
    const isAdmin = user?.role === "admin";

    const { data: permissions, isLoading } = useQuery({
        queryKey: ["managerPermissions", user?.id],
        queryFn: () => managerService.getUserPermissions(user?.id || ""),
        enabled: !!user?.id && isManager,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Helper to check if user has specific permission
    // Admins always have all permissions
    const hasPermission = (permissionKey: string) => {
        if (isAdmin) return true;
        if (!isManager) return false;
        if (!permissions) return false;

        // Check if active
        if (!permissions.is_active) return false;

        return !!permissions[permissionKey as keyof typeof permissions];
    };

    const hasTestimonialAccess = () => {
        if (isAdmin) return true;
        if (!isManager || !permissions || !permissions.is_active) return false;
        return (
            !!permissions.can_manage_testimonials ||
            !!permissions.can_add_testimonials ||
            !!permissions.can_approve_testimonials
        );
    };

    return {
        permissions,
        isLoading,
        isManager,
        isAdmin,
        hasPermission,
        hasTestimonialAccess,
    };
}
