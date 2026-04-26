import { User, Role } from "./auth.types";

export class UserDTO {
    static fromBackend(backendUser: Partial<User> & { created_at?: string }): User {
        const typedBackendUser = backendUser as Partial<User> & {
            preferred_currency?: string;
            first_name?: string;
            last_name?: string;
            avatarUrl?: string;
            avatar_url?: string;
        };

        return {
            id: backendUser.id || "",
            email: backendUser.email || "",
            name: backendUser.name || "",
            firstName: typedBackendUser.firstName || typedBackendUser.first_name || (backendUser.name ? backendUser.name.split(' ')[0] : ""),
            lastName: typedBackendUser.lastName || typedBackendUser.last_name || (backendUser.name && backendUser.name.split(' ').length > 1 ? backendUser.name.split(' ').slice(1).join(' ') : ""),
            phone: backendUser.phone,
            role: backendUser.role || "customer",
            addresses: backendUser.addresses || [],
            createdAt: backendUser.created_at || new Date().toISOString(),
            emailVerified: backendUser.emailVerified,
            phoneVerified: backendUser.phoneVerified,
            authProvider: backendUser.authProvider,
            deletionStatus: backendUser.deletionStatus,
            scheduledDeletionAt: backendUser.scheduledDeletionAt,
            language: backendUser.language,
            preferredCurrency: typedBackendUser.preferredCurrency || typedBackendUser.preferred_currency,
            image: typedBackendUser.image || typedBackendUser.avatarUrl || typedBackendUser.avatar_url,
            isActive: true,
            isDeleted: false,
            mustChangePassword: backendUser.mustChangePassword
        };
    }
}
