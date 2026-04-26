import { CONFIG } from "@/app/config";
import { apiClient } from "@/core/api/api-client";

export function resolveInvoiceDocumentUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;

  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;

  if (normalizedUrl.startsWith("/api/")) {
    return `${CONFIG.BACKEND_URL}${normalizedUrl}`;
  }

  return `${CONFIG.API_BASE_URL}${normalizedUrl}`;
}

function extractInvoiceId(url: string): string | null {
  const match = url.match(/\/(?:api\/)?invoices\/([^/?]+)\/download/);
  return match ? match[1] : null;
}

export async function openInvoiceDocument(url: string): Promise<void> {
  if (!url) return;

  const resolvedUrl = resolveInvoiceDocumentUrl(url);
  const invoiceId = extractInvoiceId(resolvedUrl);

  if (invoiceId) {
    const response = await apiClient.get<{ token: string; expiresInSeconds: number }>(
      `/invoices/${invoiceId}/download-token`
    );

    const { token } = response.data;
    const downloadUrl = resolveInvoiceDocumentUrl(`/api/invoices/${invoiceId}/download?token=${token}`);

    window.open(downloadUrl, "_blank");
    return;
  }

  window.open(resolvedUrl, "_blank", "noopener,noreferrer");
}
