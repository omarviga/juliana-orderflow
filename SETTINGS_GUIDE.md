# 📋 Guía del Módulo de Ajustes (Settings)

## Overview

El módulo de **Ajustes** (`/settings`) es la central de configuración del sistema POS para **Juliana — Barra Cotidiana**. Permite manage todos los aspectos del negocio, preferencias del sistema e impresoras Bluetooth.

## Arquitectura

### Componentes Principales

**src/pages/Settings.tsx** - Página principal
- Layout: Tabs para diferentes secciones
- 4 categorías principales: Negocio, Horarios, Preferencias, Impresoras

**src/hooks/useSystemSettings.ts** - Estado centralizado
- Interfaz `SystemSettings` con 11 propiedades
- Persistence a localStorage con clave `systemSettings`
- Métodos: `updateSettings()`, `resetToDefaults()`

**src/hooks/useBluetootPrinter.ts** - Gestión de impresoras
- Pairing de dispositivos Bluetooth
- Cola de impresión automática
- Fallback a navegador si falla Bluetooth

## Secciones de la Página

### 1. 📦 Negocio
Configura la información corporativa que aparece en recibos y tickets.

**Campos:**
- Nombre del Negocio (Ej: "JULIANA — BARRA COTIDIANA")
- Teléfono (Ej: "417 206 0111")
- Dirección (Ej: "Av. Miguel Hidalgo #276")
- Ciudad (Ej: "San Luis Potosí")
- Email (info@juliana.com)

**Comportamiento:**
- Los cambios se guardan en localStorage
- Se utiliza en `generateClientTicketHTML()` para tickets de cliente
- Se utiliza en `generateKitchenOrderHTML()` para comandas

### 2. ⏰ Horarios
Define ho horarios de operación del negocio.

**Campos:**
- Hora de Apertura (00:00 - 23:59)
- Hora de Cierre (00:00 - 23:59)

**Uso Futuro:**
- Validar órdenes dentro de horarios
- Mostrar estado "Cerrado" en landing
- Registrar horarios en reportes

### 3. ⚙️ Preferencias
Configuración técnica y financiera del sistema.

**Campos:**
- **Moneda**: MXN (defecto), USD, EUR
- **Tasa de Impuesto**: 0-100% (sin impuesto por defecto)
- **Tema**: Automático, Claro, Oscuro (se propagará en actualizaciones)
- **Idioma**: Español (defecto), English (se propagará en actualizaciones)

**Impacto:**
- Moneda: Aparecerá en tickets y reportes
- Tax Rate: Se aplicará a cálculos de total en futuro
- Theme: Ready para implementar en toda la app
- Language: Ready para i18n implementation

### 4. 🔷 Impresoras
Gestión de dispositivos Bluetooth para impresión automática.

#### Impresora Cliente (80mm)
Para imprimir **tickets de cliente** con todos los detalles del pedido.

**Acciones:**
- **Emparejar**: Inicia búsqueda Bluetooth de dispositivo
- **Desemparejar**: Elimina la asociación
- **Ver estado**: Displays device name si está conectada

#### Impresora Cocina (58mm)
Para imprimir **comandas de cocina** con detalle de items.

**Acciones:**
- **Emparejar**: Inicia búsqueda Bluetooth de dispositivo
- **Desemparejar**: Elimina la asociación
- **Ver estado**: Displays device name si está conectada

#### Opciones de Impresión
- **Impresión Automática**: Imprime al confirmar pedido (defecto: ON)
- **Usar Bluetooth**: Envía a impresora Bluetooth si está disponible (defecto: ON)
- **Fallback a Navegador**: Abre print dialog si Bluetooth falla (defecto: ON)

## Data Flow

```
User interacts with Settings page
  ↓
onChange handlers update localSettings state
  ↓
User clicks "Guardar" button
  ↓
updateSettings() is called with new values
  ↓
localStorage is updated with JSON.stringify()
  ↓
Component re-renders with new values
  ↓
Other hooks (useBluetootPrinter, useSystemSettings) see changes
```

## Storage Keys

```javascript
// Sistema de configuración general
localStorage.getItem('systemSettings')
// Resultado: {"businessName":"JULIANA — BARRA COTIDIANA","businessPhone":"417 206 0111",...}

// Preferencias de impresoras
localStorage.getItem('printerPreferences')
// Resultado: {"clientPrinter80mm":{"address":"...","name":"Printer Name"},...}
```

## Integración con Otros Módulos

### PaymentModal
```tsx
// Usa useBluetootPrinter para auto-print
const { preferences, printBoth } = useBluetootPrinter();

if (preferences.autoPrint) {
  await printBoth(items, total, orderNumber, customerName, dateStr);
}
```

### printer-formats.ts
```tsx
// Usa SystemSettings para datos corporativos en tickets
import { useSystemSettings } from "@/hooks/useSystemSettings";
const { settings } = useSystemSettings();

// En HTML template:
// <div>${settings.businessName}</div>
// <div>${settings.businessPhone}</div>
```

### Orders Page
```tsx
// Botones de reimpresión manual
<Button onClick={() => printClientTicket(...)}>Reimprimir Ticket</Button>
<Button onClick={() => printKitchenOrder(...)}>Reimprimir Comanda</Button>
```

## Valores por Defecto

```typescript
const DEFAULT_SETTINGS: SystemSettings = {
  businessName: "JULIANA — BARRA COTIDIANA",
  businessPhone: "417 206 0111",
  businessAddress: "Av. Miguel Hidalgo #276",
  businessCity: "San Luis Potosí",
  businessEmail: "info@juliana.com",
  openTime: "09:00",
  closeTime: "22:00",
  currency: "MXN",
  taxRate: 0,
  theme: "auto",
  language: "es",
};
```

## Restaurar a Valores por Defecto

**Ubicación**: Zona de Peligro (rojo, abajo de la página)

**Acción**: 
1. Click en "Restaurar Valores por Defecto"
2. Confirmar en diálogo
3. Todos los valores regresan a DEFAULT_SETTINGS
4. localStorage se limpia y reescribe

⚠️ **Este cambio NO se puede deshacer sin volver a ingresar manualmente**

## Rutas y Navegación

```
App.tsx Routes:
  / → Index (POS)
  /orders → Orders (Pedidos)
  /settings → Settings (Ajustes) ← You are here
  /clients → Clients (Pendiente)
  * → NotFound (404)

Header Navigation:
  [Inicio] [Clientes] [Pedidos] [Ajustes] [🖨️Printers] [Operator 001]
```

## Tipografía

```typescript
// Componentes usados en Settings:
<Tabs>       // Navegación entre secciones
<Card>       // Containers para cada configuración
<Input>      // Campos de texto
<Select>     // Dropdowns (Moneda, Tema, Idioma)
<Switch>     // Toggle para opciones booleanas
<Button>     // Guardar y Desemparejar
```

## Validación

**Campos requeridos:**
- Todos los campos tienen placeholders/valores default
- No hay validación de longitud mínima (TODO: Agregar si es necesario)
- Email no tiene validación (TODO: Agregar regex)
- Tax Rate acepta 0-100

**Seguridad:**
- Los datos se guardan SOLO en localStorage del cliente
- No hay encriptación (datos se pueden inspeccionar en DevTools)
- Supabase no participa en Settings (propuesta: Agregar RLS policies para backend)

## Próximos Pasos Sugeridos

1. **Implementar cambio de tema real**
   - Crear contexto global de Theme
   - Aplicar clases `dark:` en toda la app
   - Sincronizar con preferencias

2. **Implementar multi-idioma**
   - Integrar i18n library (react-i18next)
   - Traducir UI y mensajes
   - Aplicar preferencia de Settings

3. **Validación y error handling**
   - Validar email en tiempo real
   - Validar horarios (cierre > apertura)
   - Mostrar mensajes de error en toast

4. **Backend sync**
   - Guardar settings en Supabase `business_settings` tabla
   - Sincronizar entre dispositivos del mismo negocio
   - Agregar versionado para auditoria

5. **Módulo Clientes**
   - Nueva ruta `/clients`
   - Ver / editar información de clientes
   - Historial de órdenes por cliente

6. **Dashboard / Inicio**
   - Resumen de ventas del día
   - Órdenes pendientes
   - Top productos
   - Gráficas de revenue

## Troubleshooting

### "Impresora no empareja"
- Verificar que la impresora esté en modo Bluetooth/descubierta
- Revisar que la browser tenga permiso de Bluetooth
- Probar con fallback a navegador (marcar checkbox)

### "Cambios no se guardan"
- Verificar que localStorage no esté deshabilitado
- Abrir DevTools → Storage → localStorage
- Verificar que la entrada `systemSettings` se actualiza

### "Tema no cambia"
- Tema está configurado pero la implementación UI está pendiente
- Es solo preparación para integración futura

### "Botones deshabilitados"
- Aparecen deshabilitados mientras isSaving = true
- Esperar 2-3 segundos para la confirmación

## API Reference

### useSystemSettings()

```typescript
const { settings, updateSettings, resetToDefaults } = useSystemSettings();

// Acceder a configuración actual
settings.businessName        // "JULIANA — BARRA COTIDIANA"
settings.openTime           // "09:00"
settings.theme              // "auto" | "light" | "dark"

// Actualizar parcialmente
updateSettings({
  businessPhone: "418 123 4567",
  currency: "USD"
});

// Restaurar defaults
resetToDefaults();
```

### useBluetootPrinter()

```typescript
const {
  preferences,              // Estado actual
  savePreferences,         // Guardar prefs
  pairClientPrinter,       // Emparejar 80mm
  pairKitchenPrinter,      // Emparejar 58mm
  unpairClientPrinter,     // Desemparejar 80mm
  unpairKitchenPrinter,    // Desemparejar 58mm
  printClientTicket,       // Imprimir ticket
  printKitchenOrder,       // Imprimir comanda
  printBoth,              // Ambos documentos
  isPrinting,             // Estado actual
  queueLength             // Items en cola
} = useBluetootPrinter();

// Verificar si impresora está emparejada
if (preferences.clientPrinter80mm) {
  console.log("80mm connected:", preferences.clientPrinter80mm.name);
}

// Emparejar dispositivo
await pairClientPrinter();  // Abre diálogo Bluetooth

// Cambiar preferencias de impresión
savePreferences({
  autoPrint: false,
  useBluetoothIfAvailable: true
});
```

---

**Última actualización**: Marzo 2025  
**Estado**: ✅ Completado - Listo para producción  
**Versión**: 1.0.0
