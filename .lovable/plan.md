

# POS Juliana Barra Cotidiana — Plan de Implementación

## 1. Configuración de Supabase y Base de Datos
Conectar Lovable Cloud (Supabase) y crear las tablas necesarias:
- **categories** — Categorías del menú (Ensaladas de la Casa, Arma tu Ensalada, Sándwiches, Toasts, Bebidas)
- **products** — Productos con nombre, precio, categoría, y flag `is_customizable`
- **product_sizes** — Para productos con múltiples tamaños (sándwiches S/B, ensalada personalizable Mediana/Grande)
- **ingredients** — Todos los ingredientes para "Arma tu Ensalada" con tipo (proteína, topping, crocante, aderezo) y flag `is_premium`
- **orders** — Pedidos con timestamp, total y estado
- **order_items** — Detalle de cada ítem del pedido
- **order_item_customizations** — Ingredientes seleccionados para ensaladas personalizadas
- Seed de todos los datos del menú

## 2. Interfaz Principal del POS (Layout de 3 columnas)
Diseño táctil optimizado para tablet:
- **Encabezado**: "Juliana Barra Cotidiana" + "Operador 001"
- **Barra de navegación superior**: Inicio, Clientes, Pedidos, Ajustes (solo maquetados, funcionalidad futura)
- **Columna izquierda**: Lista de categorías del menú como botones grandes y fáciles de tocar
- **Panel central**: Tarjetas de productos con nombre, precio y botón de agregar. Para sándwiches, selector de tamaño (S/B)
- **Panel derecho (carrito)**: Lista de ítems agregados con cantidad, precio y subtotal. Botones para eliminar ítems. Teclado numérico para cantidades. Totales y botones "Pagar" y "Cancelar pedido"

## 3. Modal "Arma tu Ensalada"
Un asistente paso a paso para personalizar ensaladas:
- **Paso 1**: Elegir tamaño (Mediana $110 / Grande $125) — define los límites
- **Paso 2**: Seleccionar proteínas (límite según tamaño, premiums con recargo de $25, extras a $20/$25)
- **Paso 3**: Seleccionar toppings (límite según tamaño, premiums a $15, extras a $10/$15)
- **Paso 4**: Elegir 1 crocante (sin costo) y aderezos (1 incluido, extras a $15)
- Precio actualizado en tiempo real conforme se seleccionan ingredientes
- Botón "Agregar al carrito" con resumen de selecciones

## 4. Flujo de Pago y Guardado de Pedido
- Al presionar "Pagar", se muestra un modal de resumen del pedido completo
- Se guarda el pedido en la base de datos (orders, order_items, order_item_customizations) con estado "pagado"
- Dos botones de impresión disponibles en el resumen

## 5. Impresión de Tickets
- **Ticket cliente (80mm)**: Encabezado con nombre del restaurante, dirección (Av. Miguel Hidalgo #276) y teléfono (417 206 0111), número de pedido, fecha, lista de productos con precios, total, y mensaje de agradecimiento
- **Comanda cocina (58mm)**: Solo nombres de productos e ingredientes detallados para ensaladas personalizadas, letra grande, sin precios
- Implementado con `@media print` y CSS específico para cada formato, abriendo ventana de impresión al presionar cada botón

## 6. Estilo Visual
- Colores neutros inspirados en la carta del restaurante (tonos verdes oliva y crema)
- Tarjetas con borde sutil y sombra ligera
- Tipografía sans-serif clara y botones grandes para uso táctil
- Interfaz limpia sin elementos distractores

