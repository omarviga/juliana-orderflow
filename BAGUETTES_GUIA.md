# Guía para agregar la categoría Baguettes

## Problema encontrado
Las políticas de seguridad (RLS) en Supabase actualmente solo permiten lectura pública. Para agregar datos, necesitas ejecutar el SQL directamente en Supabase Studio.

## Solución - Ejecutar SQL en Supabase Studio

### Opción 1: Con interfaz web (Recomendado)
1. Abre [Supabase Dashboard](https://app.supabase.com/project/vexsdilhoejvvaxysmvu/sql/new)
2. Abre la pestaña **SQL Editor**
3. Haz clic en **+ New Query**
4. Copia y pega el contenido del archivo `BAGUETTES_SETUP.sql`
5. Haz clic en **Run** (o Ctrl+Enter)
6. Deberías ver confirmación de que se creó la categoría y los 5 productos

### Opción 2: Desde CLI (si tienes supabase-cli instalado)
```bash
supabase migration up
```

## Datos que se crearán:

**Categoría:** Baguettes (ubicada después de Sándwiches)

**Productos:**
- Baguette Pavo y Panela - $85
- Baguette Serrano y Queso - $110
- Baguette Healthy - $75
- Baguette Roast Beef - $110
- Baguette Garlic Grill Cheese - $75

## Verificación
Después de ejecutar el SQL, los datos deberían aparecer inmediatamente en la aplicación (se sincronizarán automáticamente mediante React Query).

## Notas técnicas
- Se ha creado la migración SQL en: `supabase/migrations/20260223000001_add_baguettes_category.sql`
- También se incluye una migración para actualizar políticas RLS: `supabase/migrations/20260223000002_update_rls_policies.sql`
