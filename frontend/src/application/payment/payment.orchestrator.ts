import { loadRazorpay, prefetchRazorpay } from "@/core/payments/razorpay";

export const paymentOrchestrator = {
  loadGateway: loadRazorpay,
  prefetchGateway: prefetchRazorpay,
};
