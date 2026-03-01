# Consultas de Productos (SQL + TypeScript)

## SQL Editor

### 1) Ver todas las categorías y sus productos
```sql
SELECT
  c.name as categoria,
  p.name as producto,
  p.price,
  p.is_customizable,
  p.display_order
FROM public.products p
LEFT JOIN public.categories c ON p.category_id = c.id
ORDER BY c.display_order, p.display_order;
```

### 2) Productos por categoría (conteo)
```sql
SELECT
  c.name as categoria,
  COUNT(p.id) as total_productos,
  SUM(CASE WHEN p.price > 0 THEN 1 ELSE 0 END) as con_precio,
  SUM(CASE WHEN p.is_customizable THEN 1 ELSE 0 END) as personalizables
FROM public.categories c
LEFT JOIN public.products p ON p.category_id = c.id
GROUP BY c.id, c.name
ORDER BY c.display_order;
```

### 3) Ensaladas (categoría `a1000000-0000-0000-0000-000000000001`)
```sql
SELECT name, price, display_order
FROM public.products
WHERE category_id = 'a1000000-0000-0000-0000-000000000001'
ORDER BY display_order;
```

### 4) Bebidas (categoría `a1000000-0000-0000-0000-000000000005`)
```sql
SELECT name, price, description
FROM public.products
WHERE category_id = 'a1000000-0000-0000-0000-000000000005'
ORDER BY price DESC;
```

### 5) Productos personalizables
```sql
SELECT name, category_id
FROM public.products
WHERE is_customizable = true;
```

### 6) Productos sin precio definido
```sql
SELECT name, category_id
FROM public.products
WHERE price IS NULL;
```

### 7) Búsqueda de productos por nombre
```sql
SELECT name, price, category_id
FROM public.products
WHERE name ILIKE '%ensalada%'
   OR name ILIKE '%café%'
   OR name ILIKE '%baguette%';
```

## TypeScript (Supabase)

Estas consultas quedaron disponibles en `src/hooks/useMenuData.ts`:

- `useProducts()`: todos los productos con categoría relacionada.
- `useProductsByCategory(categoryId)`: productos por categoría.
- `useProductsWithPrice()`: productos con precio (no NULL), ordenados por precio desc.
- `useSearchProducts(query)`: búsqueda por nombre.
- `useCustomizableProducts()`: productos personalizables con nombre de categoría.

## Verificación rápida

```sql
-- Total de productos
SELECT COUNT(*) as total FROM public.products;

-- Duplicados por nombre + categoría
SELECT name, category_id, COUNT(*) as cantidad
FROM public.products
GROUP BY name, category_id
HAVING COUNT(*) > 1;
```
