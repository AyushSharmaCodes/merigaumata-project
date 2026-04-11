import { CONFIG } from "@/config";

function isProtectedInvoiceRoute(url: string): boolean {
  return /\/api\/invoices\/[^/]+\/download(?:\?|$)/.test(url);
}

export function resolveInvoiceDocumentUrl(url: string): string {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;

  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;

  if (normalizedUrl.startsWith("/api/")) {
    return CONFIG.USE_SAME_ORIGIN_API
      ? normalizedUrl
      : `${CONFIG.BACKEND_URL}${normalizedUrl}`;
  }

  return CONFIG.BACKEND_URL ? `${CONFIG.BACKEND_URL}${normalizedUrl}` : normalizedUrl;
}

export async function openInvoiceDocument(url: string): Promise<void> {
  if (!url) return;
  const resolvedUrl = resolveInvoiceDocumentUrl(url);

  if (isProtectedInvoiceRoute(resolvedUrl)) {
    window.open(resolvedUrl, "_blank");
    return;
  }

  window.open(resolvedUrl, "_blank", "noopener,noreferrer");
}
