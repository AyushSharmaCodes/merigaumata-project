import { apiClient } from '@/core/api/api-client';

export const authApi = {
    register: async (data: any) => {
        const response = await apiClient.post('/auth/register', data);
        return response.data;
    },

    login: async (email: string, otp: string) => {
        const response = await apiClient.post('/auth/verify-login-otp', { email, otp });
        return response.data;
    },

    googleAuthorize: async () => {
        const response = await apiClient.get('/auth/google/authorize');
        return response.data;
    },

    googleExchange: async (code: string, state: string) => {
        const response = await apiClient.post('/auth/google/exchange', { code, state });
        return response.data;
    },

    logout: async (refreshToken?: string) => {
        const body = refreshToken ? { refresh_token: refreshToken } : {};
        await apiClient.post('/auth/logout', body);
    },

    refresh: async (silent: boolean = false) => {
        const response = await apiClient.post('/auth/refresh', {}, { silent } as any);
        return response.data;
    },

    resetPasswordRequest: async (email: string) => {
        const response = await apiClient.post('/auth/reset-password-request', { email });
        return response.data;
    },

    validateResetToken: async (token: string) => {
        const response = await apiClient.get(`/auth/validate-reset-token?token=${token}`);
        return response.data;
    },

    resetPassword: async (token: string, newPassword: string) => {
        const response = await apiClient.post('/auth/reset-password', { token, newPassword });
        return response.data;
    },

    changePassword: async (data: any) => {
        await apiClient.post("/auth/change-password", data);
    },

    sendChangePasswordOTP: async () => {
        await apiClient.post("/auth/send-change-password-otp");
    },

    validateCredentials: async (email: string, password: string) => {
        const response = await apiClient.post('/auth/validate-credentials', { email, password });
        return response.data;
    },

    resendConfirmation: async (email: string) => {
        const response = await apiClient.post('/auth/resend-confirmation', { email });
        return response.data;
    }
};
