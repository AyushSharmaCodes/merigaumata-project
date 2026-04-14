export const endpoints = {
    getCurrencyContext: "/settings/currency-context",
    getDeliverySettings: "/settings/delivery",
    updateDeliverySettings: "/settings/delivery",
    getMaintenanceSettings: "/settings/maintenance",
    updateMaintenanceSettings: "/settings/maintenance",
} as const;

export type ApiEndpointKey = keyof typeof endpoints;
