import { openInvoiceDocument, orderService, resolveInvoiceDocumentUrl } from "@/domains/order";

export const orderOrchestrator = {
  openInvoiceDocument,
  resolveInvoiceDocumentUrl,
  regenerateInvoice: orderService.regenerateInvoice,
};
