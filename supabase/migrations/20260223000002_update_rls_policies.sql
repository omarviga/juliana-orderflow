-- Update RLS policies for categories to allow inserts
DROP POLICY "Categories are publicly readable" ON public.categories;
CREATE POLICY "Categories are publicly readable" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Categories can be inserted" ON public.categories FOR INSERT WITH CHECK (true);

-- Update RLS policies for products to allow inserts
DROP POLICY "Products are publicly readable" ON public.products;
CREATE POLICY "Products are publicly readable" ON public.products FOR SELECT USING (true);
CREATE POLICY "Products can be inserted" ON public.products FOR INSERT WITH CHECK (true);
