import { apiClient } from "@/lib/api-client";

function getFilenameFromDisposition(contentDisposition?: string): string {
  if (!contentDisposition) return "invoice.pdf";

  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"/i)
    || contentDisposition.match(/filename\s*=\s*([^;]+)/i);

  return asciiMatch?.[1]?.trim() || "invoice.pdf";
}

function isProtectedInvoiceRoute(url: string): boolean {
  return /\/api\/invoices\/[^/]+\/download(?:\?|$)/.test(url);
}

export async function openInvoiceDocument(url: string): Promise<void> {
  if (!url) return;

  if (!isProtectedInvoiceRoute(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  const response = await apiClient.get<Blob>(url, {
    responseType: "blob",
  });

  const blobUrl = URL.createObjectURL(response.data);
  const filename = getFilenameFromDisposition(response.headers["content-disposition"]);
  const openedWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}
