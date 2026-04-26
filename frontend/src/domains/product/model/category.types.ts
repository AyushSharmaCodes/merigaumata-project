export type CategoryType = "product" | "event" | "faq" | "gallery";

export interface Category {
  id: string;
  name: string;
  original_name?: string;
  name_i18n?: Record<string, string>;
  type: CategoryType;
  createdAt: string;
}
