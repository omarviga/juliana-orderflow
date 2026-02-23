-- INSTRUCCIONES:
-- 1. Abre Supabase Dashboard: https://app.supabase.com/project/vexsdilhoejvvaxysmvu/sql/new
-- 2. Copia y pega TODO el código abajo
-- 3. Ejecuta (Run)

-- Step 1: Get the display_order of Sándwiches category and calculate Baguettes order
-- (This will be done in steps for clarity)

-- First, let's check what the current display_order of Sándwiches is:
-- SELECT display_order FROM public.categories WHERE name = 'Sándwiches';

-- Then insert the Baguettes category
INSERT INTO public.categories (name, display_order)
SELECT 'Baguettes', COALESCE((
  SELECT display_order + 1 
  FROM public.categories 
  WHERE name = 'Sándwiches'
), 10)  -- Fallback to 10 if Sándwiches doesn't exist
ON CONFLICT DO NOTHING;  -- Prevent duplicate insertions

-- Now insert the Baguette products
INSERT INTO public.products (category_id, name, price, is_customizable, display_order)
SELECT 
  c.id,
  p.name,
  p.price,
  false,
  p.display_order
FROM (
  SELECT 'Baguette Pavo y Panela' as name, 85.00 as price, 1 as display_order
  UNION ALL
  SELECT 'Baguette Serrano y Queso', 110.00, 2
  UNION ALL
  SELECT 'Baguette Healthy', 75.00, 3
  UNION ALL
  SELECT 'Baguette Roast Beef', 110.00, 4
  UNION ALL
  SELECT 'Baguette Garlic Grill Cheese', 75.00, 5
) p
CROSS JOIN (SELECT id FROM public.categories WHERE name = 'Baguettes') c
WHERE NOT EXISTS (
  SELECT 1 FROM public.products 
  WHERE category_id = c.id AND name = p.name
);

-- Verify the results
SELECT 'Categories' as section;
SELECT id, name, display_order FROM public.categories WHERE name = 'Baguettes';

SELECT 'Products' as section;
SELECT id, name, price, display_order FROM public.products 
WHERE category_id = (SELECT id FROM public.categories WHERE name = 'Baguettes')
ORDER BY display_order;
