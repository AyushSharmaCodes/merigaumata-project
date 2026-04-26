import { categoryApi, contactApi, contactInfoApi, couponApi, currencyApi, policyApi } from "../api/settings.api";
import { deliveryApi } from "../api/delivery.api";

export const settingsService = {
  categories: categoryApi,
  contact: contactApi,
  contactInfo: contactInfoApi,
  coupons: couponApi,
  currency: currencyApi,
  delivery: deliveryApi,
  policy: policyApi,
};
