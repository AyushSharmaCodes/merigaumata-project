import { orderApi } from "../api/order.api";

export const orderRulesService = {
    // Pure logic could go here, e.g. mapping statuses to human readable labels
    getStatusColor: (status: string) => {
        switch (status) {
            case 'PENDING': return 'warning';
            case 'CONFIRMED': return 'info';
            case 'DELIVERED': return 'success';
            case 'CANCELLED': return 'destructive';
            default: return 'secondary';
        }
    },

    // Business rules for returns
    isReturnable: (order: any) => {
        if (order.status !== 'DELIVERED') return false;
        // ... more complex logic ...
        return true;
    },

    // In a real app, transformation logic (like address transformation) should be here
    transformCheckoutAddress: (address: any) => {
        if (!address) return null;
        return {
            ...address,
            formatted: `${address.addressLine}, ${address.locality}, ${address.city}, ${address.state} - ${address.pincode}`
        };
    }
};
