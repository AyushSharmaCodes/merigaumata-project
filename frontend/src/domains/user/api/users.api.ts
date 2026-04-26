import { apiClient } from "@/core/api/api-client";
import { User, CreateUserDto } from "@/shared/types";

export const userService = {
    getAll: async (): Promise<User[]> => {
        const response = await apiClient.get("/users");
        return response.data;
    },

    toggleBlockStatus: async (id: string, isBlocked: boolean): Promise<User> => {
        const response = await apiClient.post(`/users/${id}/block`, { isBlocked });
        return response.data.user;
    },

    create: async (userData: CreateUserDto): Promise<User> => {
        const response = await apiClient.post("/users", userData);
        return response.data;
    }
};
