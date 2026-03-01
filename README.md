# Welcome to your Lovable project

## Project info

**URL**: <https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID>

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
Aquí tienes la transcripción actualizada con el flujo de pago en efectivo y el cambio incluido:

---

# POS Juliana Barra Cotidiana — Plan de Implementación

## 1. Configuración de Supabase y Base de Datos

Conectar Lovable Cloud (Supabase) y crear las tablas necesarias:

- **categories** — Categorías del menú (Ensaladas de la Casa, Arma tu Ensalada, Sándwiches, Toasts, Bebidas)
- **products** — Productos con nombre, precio, categoría, y flag `is_customizable`
- **product_sizes** — Para productos con múltiples tamaños (sándwiches S/B, ensalada personalizable Mediana/Grande)
- **ingredients** — Todos los ingredientes para "Arma tu Ensalada" con tipo (proteína, topping, crocante, aderezo) y flag `is_premium`
- **orders** — Pedidos con timestamp, total, método de pago, efectivo_recibido, cambio y estado
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
- **Modal de pago mejorado**:
  - Opciones de pago: Efectivo, Tarjeta, Transferencia
  - Si se selecciona **Efectivo**, aparece un campo para ingresar el monto con el que paga el cliente
  - Cálculo automático del cambio mientras el operador escribe el monto recibido
  - Se muestra claramente el cambio a entregar: **"Cambio: $XX.XX"**
  - Validación: el monto recibido debe ser mayor o igual al total
- Al confirmar, se guarda el pedido en la base de datos (orders, order_items, order_item_customizations) con:
  - Estado "pagado"
  - Método de pago
  - Si es efectivo: monto recibido y cambio calculado
- Dos botones de impresión disponibles en el resumen final

## 5. Impresión de Tickets

- **Ticket cliente (80mm)**:
  - Encabezado con nombre del restaurante, dirección (Av. Miguel Hidalgo #276) y teléfono (417 206 0111)
  - Número de pedido y fecha
  - Lista de productos con precios
  - **Si el pago fue en efectivo**: mostrar "Efectivo: $XX.XX" y "Cambio: $XX.XX"
  - Total
  - Mensaje de agradecimiento

- **Comanda cocina (58mm)**: Solo nombres de productos e ingredientes detallados para ensaladas personalizadas, letra grande, sin precios

- Implementado con `@media print` y CSS específico para cada formato, abriendo ventana de impresión al presionar cada botón

## 6. Estilo Visual

- Colores neutros inspirados en la carta del restaurante (tonos verdes oliva y crema)
- Tarjetas con borde sutil y sombra ligera
- Tipografía sans-serif clara y botones grandes para uso táctil
- Interfaz limpia sin elementos distractores

---
