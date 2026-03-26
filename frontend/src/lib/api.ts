export const endpoints = {
    getCurrencyContext: "/settings/currency-context",
    getDeliverySettings: "/settings/delivery",
    updateDeliverySettings: "/settings/delivery",
} as const;

export type ApiEndpointKey = keyof typeof endpoints;
