import { User, Role } from "@/types";

export class UserDTO {
    static fromSupabase(supabaseUser: { id: string; email?: string; created_at: string; phone?: string; user_metadata?: Record<string, unknown>; phone_confirmed_at?: string }): User {
        if (!supabaseUser) {
            throw new Error("Cannot map null user");
        }

        const metadata = supabaseUser.user_metadata || {};

        return {
            id: supabaseUser.id,
            email: supabaseUser.email || "",
            name: (metadata.name as string) || "",
            firstName: metadata.name ? (metadata.name as string).split(' ')[0] : "",
            lastName: metadata.name && (metadata.name as string).split(' ').length > 1 ? (metadata.name as string).split(' ').slice(1).join(' ') : "",
            phone: supabaseUser.phone || (metadata.phone as string) || undefined,
            role: (metadata.role as Role) || "customer",
            addresses: [], // Addresses are usually fetched separately or need distinct mapping
            createdAt: supabaseUser.created_at,
            phoneVerified: supabaseUser.phone_confirmed_at ? true : false,
            // Default values for optional fields to ensuring structure stability
            isActive: true,
            isDeleted: false
        };
    }

    static fromBackend(backendUser: Partial<User> & { created_at?: string }): User {
        // If we fetch user from our /auth/me endpoint, the structure might differ slightly
        // This method ensures we can handle that too.
        return {
            id: backendUser.id || "",
            email: backendUser.email || "",
            name: backendUser.name || "",
            firstName: backendUser.name ? backendUser.name.split(' ')[0] : "",
            lastName: backendUser.name && backendUser.name.split(' ').length > 1 ? backendUser.name.split(' ').slice(1).join(' ') : "",
            phone: backendUser.phone,
            role: backendUser.role || "customer",
            addresses: backendUser.addresses || [],
            createdAt: backendUser.created_at || new Date().toISOString(),
            phoneVerified: backendUser.phoneVerified,
            isActive: true,
            isDeleted: false,
            mustChangePassword: backendUser.mustChangePassword
        };
    }
}
