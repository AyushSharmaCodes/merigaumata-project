import { buildFolderName, firstNonEmpty } from "@/core/utils/pathUtils";

export const getProductUploadFolder = (product?: {
  title?: string;
  title_i18n?: Record<string, string>;
  name?: string;
}) =>
  buildFolderName(
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

export const getBlogUploadFolder = (blog?: {
  title?: string;
  title_i18n?: Record<string, string>;
  blog_code?: string;
}) =>
  buildFolderName(
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

export const getEventUploadFolder = (event?: {
  title?: string;
  title_i18n?: Record<string, string>;
  event_code?: string;
}) =>
  buildFolderName(
    firstNonEmpty(
      event?.title,
      event?.title_i18n?.en,
      event?.title_i18n?.hi,
      event?.title_i18n?.ta,
      event?.title_i18n?.te,
      event?.event_code
    ),
    "event"
  );

export const getCarouselUploadFolder = () => "carousel";

export const getTestimonialUploadFolder = (testimonial?: {
  name?: string;
  name_i18n?: Record<string, string>;
}) =>
  buildFolderName(
    firstNonEmpty(
      testimonial?.name,
      testimonial?.name_i18n?.en,
      testimonial?.name_i18n?.hi,
      testimonial?.name_i18n?.ta,
      testimonial?.name_i18n?.te
    ),
    "testimonial"
  );

export const getGalleryUploadFolder = (folderName: string) => buildFolderName(folderName, "gallery");
