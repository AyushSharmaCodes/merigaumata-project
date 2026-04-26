import { CheckoutAddress } from "@/shared/types";

/**
 * Utility to consistently update address lists when a primary address is changed.
 * This ensures only one address is marked as primary in the frontend cache.
 * 
 * @param addresses - The current list of addresses
 * @param primaryId - The ID of the address that should be primary
 * @returns A new list of addresses with only one primary address
 */
export const syncPrimaryAddress = (addresses: CheckoutAddress[], primaryId: string): CheckoutAddress[] => {
    return addresses.map((address) => ({
        ...address,
        is_primary: address.id === primaryId,
        // Also sync isPrimary for backward compatibility if it exists
        ...( 'isPrimary' in address ? { isPrimary: address.id === primaryId } : {} )
    }));
};
