import { CONFIG } from "@/config";
import { apiClient } from "@/lib/api-client";

/**
 * Resolve a relative /api/ path to a fully-qualified URL using BACKEND_URL.
 */
export function resolveInvoiceDocumentUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;

  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;

  // If it starts with /api/, we use the BACKEND_URL (which usually has no /api)
  if (normalizedUrl.startsWith("/api/")) {
    return `${CONFIG.BACKEND_URL}${normalizedUrl}`;
  }

  // Otherwise, it's relative to the API root
  return `${CONFIG.API_BASE_URL}${normalizedUrl}`;
}

/**
 * Extract invoice ID from an /api/invoices/:id/download URL.
 */
function extractInvoiceId(url: string): string | null {
  const match = url.match(/\/api\/invoices\/([^/?]+)\/download/);
  return match ? match[1] : null;
}

/**
 * Open an invoice PDF in a new browser tab, keeping the Supabase
 * infrastructure completely hidden.
 *
 * Flow for internal invoices (/api/invoices/:id/download):
 *  1. Call GET /api/invoices/:id/download-token via authenticated apiClient.
 *     → Backend verifies ownership, issues a 60-second single-use token.
 *  2. Open /api/invoices/:id/download?token=xxx with window.open.
 *     → Browser shows YOUR domain URL (e.g. api.merigaumata.in/...).
 *     → Backend proxies PDF bytes from Supabase — Supabase URL never visible.
 *
 * Flow for public URLs (Razorpay short links, etc.):
 *  → Opened directly with window.open.
 */
export async function openInvoiceDocument(url: string): Promise<void> {
  if (!url) return;

  const resolvedUrl = resolveInvoiceDocumentUrl(url);
  const invoiceId = extractInvoiceId(resolvedUrl);

  if (invoiceId) {
    // Step 1: Fetch a short-lived one-time token via authenticated apiClient
    const response = await apiClient.get<{ token: string; expiresInSeconds: number }>(
      `/invoices/${invoiceId}/download-token`
    );

    const { token } = response.data;

    // Step 2: Build the download URL using our own domain + the token
    const downloadUrl = resolveInvoiceDocumentUrl(
      `/api/invoices/${invoiceId}/download?token=${token}`
    );

    // Step 3: Open in new tab — browser shows our domain, never Supabase
    window.open(downloadUrl, "_blank");
    return;
  }

  // Already a direct public URL (e.g. Razorpay short_url)
  window.open(resolvedUrl, "_blank", "noopener,noreferrer");
}
