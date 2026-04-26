import { authApi } from "../api/auth.api";
import { UserDTO } from "../model/user.dto";
import { authSessionService } from "./auth-session.service";
import { logger } from "@/core/observability/logger";

export const authService = {
    register: async (data: any) => {
        const response = await authApi.register(data);
        return UserDTO.fromBackend(response.user);
    },

    login: async (email: string, otp: string) => {
        const response = await authApi.login(email, otp);
        const { user, tokens } = response;
        authSessionService.setSession(tokens ?? {});
        return UserDTO.fromBackend(user);
    },

    logout: async () => {
        const snapshot = authSessionService.getSession();
        authSessionService.logoutCleanup();
        try {
            await authApi.logout(snapshot?.refreshToken);
        } catch (err) {
            logger.warn("Backend logout error:", err);
        }
    },

    refreshSession: async (silent: boolean = false) => {
        try {
            const response = await authApi.refresh(silent);
            if (response?.tokens) {
                authSessionService.setSession(response.tokens);
            }
            return response?.user ? UserDTO.fromBackend(response.user) : null;
        } catch (err) {
            authSessionService.logoutCleanup();
            return null;
        }
    },

    googleAuthorize: async () => {
        const data = await authApi.googleAuthorize();
        if (!data?.url) throw new Error('errors.auth.googleRedirectFailed');
        window.location.assign(data.url);
    },

    googleExchange: async (code: string, state: string) => {
        const response = await authApi.googleExchange(code, state);
        authSessionService.setSession(response.tokens ?? {});
        return {
            user: UserDTO.fromBackend(response.user),
            tokens: response.tokens
        };
    }
};
