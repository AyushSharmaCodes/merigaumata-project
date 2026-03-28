-- Prevent duplicate product reviews per user even under concurrent requests.

DELETE FROM public.reviews a
USING public.reviews b
WHERE a.id < b.id
  AND a.product_id = b.product_id
  AND a.user_id = b.user_id
  AND a.user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_product_user_unique
ON public.reviews(product_id, user_id)
WHERE user_id IS NOT NULL;
