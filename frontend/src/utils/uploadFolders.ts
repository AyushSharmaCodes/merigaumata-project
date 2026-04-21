const normalizeFolderSegment = (value?: string | null): string => {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .toLowerCase();
};

const firstNonEmpty = (...values: Array<string | undefined | null>) =>
  values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() || "";

export const buildUploadFolder = (value?: string | null, fallback = "untitled") =>
  normalizeFolderSegment(value) || fallback;

export const getProductUploadFolder = (product?: {
  title?: string;
  title_i18n?: Record<string, string>;
  name?: string;
}) =>
  buildUploadFolder(
    firstNonEmpty(
      product?.title,
      product?.title_i18n?.en,
      product?.title_i18n?.hi,
      product?.title_i18n?.ta,
      product?.title_i18n?.te,
      product?.name
    ),
    "product"
  );

export const getEventUploadFolder = (event?: {
  title?: string;
  title_i18n?: Record<string, string>;
  name?: string;
}) =>
  buildUploadFolder(
    firstNonEmpty(
      event?.title,
      event?.title_i18n?.en,
      event?.title_i18n?.hi,
      event?.title_i18n?.ta,
      event?.title_i18n?.te,
      event?.name
    ),
    "event"
  );

export const getBlogUploadFolder = (blog?: {
  title?: string;
  title_i18n?: Record<string, string>;
  blog_code?: string;
}) =>
  buildUploadFolder(
    firstNonEmpty(
      blog?.title,
      blog?.title_i18n?.en,
      blog?.title_i18n?.hi,
      blog?.title_i18n?.ta,
      blog?.title_i18n?.te,
      blog?.blog_code
    ),
    "blog"
  );

export const getTestimonialUploadFolder = (testimonial?: {
  name?: string;
  name_i18n?: Record<string, string>;
}) =>
  buildUploadFolder(
    firstNonEmpty(
      testimonial?.name,
      testimonial?.name_i18n?.en,
      testimonial?.name_i18n?.hi,
      testimonial?.name_i18n?.ta,
      testimonial?.name_i18n?.te
    ),
    "testimonial"
  );

export const getTeamUploadFolder = (member?: {
  name?: string;
  name_i18n?: Record<string, string>;
}) =>
  buildUploadFolder(
    firstNonEmpty(
      member?.name,
      member?.name_i18n?.en,
      member?.name_i18n?.hi,
      member?.name_i18n?.ta,
      member?.name_i18n?.te
    ),
    "team-member"
  );

export const getGalleryUploadFolder = (folderName?: string | null, fallbackId?: string | null) =>
  buildUploadFolder(firstNonEmpty(folderName, fallbackId), "gallery");

export const getCarouselUploadFolder = () => "carousel";
