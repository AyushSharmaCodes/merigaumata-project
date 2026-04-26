import { addressApi } from "../api/address.api";
import { userService } from "../services/user.service";
import CacheHelper from "@/core/utils/cacheHelper";

export const transformToCheckoutAddress = userService.transformToCheckoutAddress;

export const addressService = {
    getAddresses: async () => {
        const data = await addressApi.getAddresses();
        return (data || []).map(userService.transformToCheckoutAddress);
    },

    getAddressesCached: async () => {
        return CacheHelper.getOrFetch(
            'user_addresses',
            async () => {
                const data = await addressApi.getAddresses();
                return (data || []).map(userService.transformToCheckoutAddress);
            },
            { ttl: 60 * 60 * 1000 }
        );
    },

    invalidateCache: () => {
        CacheHelper.remove('user_addresses');
    },

    createAddress: async (data: any) => {
        const payload = userService.transformToBackendAddressPayload(data);
        const response = await addressApi.createAddress(payload);
        return userService.transformToCheckoutAddress(response.address);
    },

    updateAddress: async (id: string, data: any) => {
        const payload = userService.transformToBackendAddressPayload(data);
        const response = await addressApi.updateAddress(id, payload);
        return userService.transformToCheckoutAddress(response.address);
    },

    deleteAddress: addressApi.deleteAddress,

    setPrimary: async (id: string, type: string) => {
        const response = await addressApi.setPrimary(id, type);
        return userService.transformToCheckoutAddress(response.address);
    },
};
