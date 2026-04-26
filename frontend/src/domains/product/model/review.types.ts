import { z } from "zod";

export const reviewSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "products.validation.titleMin")
    .max(100, "products.validation.titleMax"),
  comment: z
    .string()
    .trim()
    .min(10, "products.validation.commentMin")
    .max(2000, "products.validation.commentMax"),
  rating: z.number().min(1, "products.validation.ratingRequired").max(5),
});

export type ReviewFormData = z.infer<typeof reviewSchema>;
