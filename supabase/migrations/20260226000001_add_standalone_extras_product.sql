-- Product used to charge standalone extras as their own cart line.
-- Keeps order_items.product_id integrity while supporting "solo una cosita mas".

INSERT INTO public.categories (name, display_order)
SELECT
  'Extras',
  COALESCE((SELECT MAX(display_order) + 1 FROM public.categories), 0)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories
  WHERE LOWER(name) = 'extras'
);

INSERT INTO public.products (category_id, name, price, is_customizable, display_order)
SELECT
  c.id,
  'Extra suelto',
  0.00,
  false,
  1
FROM (
  SELECT id
  FROM public.categories
  WHERE LOWER(name) = 'extras'
  ORDER BY display_order ASC
  LIMIT 1
) c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.products
  WHERE LOWER(name) = 'extra suelto'
);
