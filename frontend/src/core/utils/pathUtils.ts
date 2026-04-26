/**
 * Normalizes a string for use as a folder or path segment.
 */
export const normalizePathSegment = (value?: string | null): string => {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .toLowerCase();
};

/**
 * Returns the first non-empty string from a list of values.
 */
export const firstNonEmpty = (...values: Array<string | undefined | null>) =>
  values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() || "";

/**
 * Builds a folder name from a value with a fallback.
 */
export const buildFolderName = (value?: string | null, fallback = "untitled") =>
  normalizePathSegment(value) || fallback;
