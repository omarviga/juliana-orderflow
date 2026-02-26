-- Allow product price edits from app and ensure "Postres" category exists.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'Products can be updated'
  ) THEN
    CREATE POLICY "Products can be updated"
      ON public.products
      FOR UPDATE
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.categories (name, display_order)
SELECT
  'Postres',
  COALESCE((SELECT MAX(display_order) + 1 FROM public.categories), 0)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories
  WHERE LOWER(name) = 'postres'
);
