-- Insert Baguettes category after Sándwiches
INSERT INTO public.categories (name, display_order)
SELECT 'Baguettes', COALESCE((
  SELECT display_order + 1 
  FROM public.categories 
  WHERE name = 'Sándwiches'
), 0);

-- Get the category ID for Baguettes to insert products
WITH baguettes_cat AS (
  SELECT id FROM public.categories WHERE name = 'Baguettes'
)
INSERT INTO public.products (category_id, name, price, is_customizable, display_order)
VALUES
  ((SELECT id FROM baguettes_cat), 'Baguette Pavo y Panela', 85.00, false, 1),
  ((SELECT id FROM baguettes_cat), 'Baguette Serrano y Queso', 110.00, false, 2),
  ((SELECT id FROM baguettes_cat), 'Baguette Healthy', 75.00, false, 3),
  ((SELECT id FROM baguettes_cat), 'Baguette Roast Beef', 110.00, false, 4),
  ((SELECT id FROM baguettes_cat), 'Baguette Garlic Grill Cheese', 75.00, false, 5);
