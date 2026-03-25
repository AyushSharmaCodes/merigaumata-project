import { logger } from "@/lib/logger";

export const downloadCSV = (data: Record<string, unknown>[], filename: string) => {
  if (data.length === 0) return;

  // Get all unique headers from all rows to ensure no data is lost
  const headers = Array.from(new Set(data.flatMap(row => Object.keys(row))));

  // Create CSV content with escaped headers and rows
  const csvContent = [
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','), // Header row with quotes
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];

        // Handle null/undefined
        if (value === null || value === undefined) return '';

        // Handle objects/arrays (though flattenObject should have handled most)
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

        // Escape quotes by doubling them and wrap in quotes if it contains separator or quotes
        // Always wrapping in quotes is safer for CSV
        return `"${stringValue.replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const csvData = BOM + csvContent;

  // Ensure extension is exactly .csv
  const baseName = filename.endsWith('.csv') ? filename.slice(0, -4) : filename;
  const dateStr = new Date().toISOString().split('T')[0];
  const finalFilename = `${baseName}_${dateStr}.csv`;

  logger.debug("Preparing CSV download", { finalFilename });

  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  // Attempt 1: Standard Anchor Click (for most browsers)
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', finalFilename);
  link.style.display = 'none';
  document.body.appendChild(link);

  try {
    link.click();
  } catch (e) {
    logger.warn("Anchor click failed during CSV download", { err: e, finalFilename });
  }

  // Attempt 2: Iframe fallback (for stubborn environments)
  setTimeout(() => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);

    // Cleanup iframe
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 60000);
  }, 500);

  // Cleanup anchor
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    // Don't revoke URL immediately in case the iframe needs it
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, 1000);
};

export const flattenObject = (obj: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
  return Object.keys(obj).reduce((acc: Record<string, unknown>, key: string) => {
    const pre = prefix.length ? `${prefix}_` : '';
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(acc, flattenObject(value as Record<string, unknown>, pre + key));
    } else if (Array.isArray(value)) {
      acc[pre + key] = value.join('; ');
    } else {
      acc[pre + key] = value;
    }
    return acc;
  }, {});
};
