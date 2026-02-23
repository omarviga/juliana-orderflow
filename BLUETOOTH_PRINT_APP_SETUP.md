# 📱 Guía: Bluetooth Print App (RECOMENDADO)

## 🎯 ¿Por qué Bluetooth Print App?

**Bluetooth Print App** es más confiable que Web Bluetooth API porque:
- ✅ Funciona mejor con impresoras térmicas Android
- ✅ Mejor soporte para dispositivos emparejados
- ✅ Menos problemas de conexión
- ✅ Impresión más rápida y estable
- ✅ Compatible con todas las impresoras térmicas

## 📥 Instalación

### Paso 1: Instalar la App en tu Tablet Android

1. Abre **Google Play Store** en tu tablet
2. Busca: **"Bluetooth Print"** (creada por Mate Technologies)
3. Haz clic en **"Instalar"**
4. Espera a que se complete la instalación

**Link directo:** https://play.google.com/store/apps/details?id=mate.bluetoothprint

### Paso 2: Habilitar Browser Print en la App

1. Abre la app **Bluetooth Print**
2. Ve a **Settings** → **Configuración**
3. Busca **"Browser Print"** y **habilítalo**
4. Guarda los cambios

### Paso 3: Preparar la Impresora

1. **Enciende la impresora térmica**
2. **Activa el modo Bluetooth** (usualmente presionando el botón 3-5 segundos)
   - Busca una luz LED azul parpadeando
3. **Espera 30 segundos** a que entre en modo descubierta

### Paso 4: Emparejar en Android

1. Ve a **Configuración → Bluetooth**
2. Activa **Bluetooth**
3. Busca y selecciona tu impresora (ej: "PROVA_THERMAL", "EPSON-TM", "XPrinter")
4. Completa el emparejamiento (puede pedir PIN: prueba `0000` o `1234`)
5. Deberías ver la impresora como **"Conectada"**

### Paso 5: Configurar el Servidor (Producción)

Para que funcione desde tu sitio web en producción, necesitas un servidor que retorne los datos en JSON:

**Opción A: Usar el servidor incluido (Desarrollo Local)**
```bash
cd /workspaces/juliana-orderflow
npm install express cors
node printer-server.js
```

**Opción B: Desplegar en producción**
- Despliega `printer-server.js` en tu servidor (Heroku, Railway, Render, etc.)
- O usa **Supabase Edge Functions** para crear el endpoint
- O implementa el endpoint en tu backend actual

## 🖨️ Uso

### Impresión desde Juliana POS

1. Completa tu pedido en Juliana POS
2. Ingresa el nombre del cliente
3. Haz clic en **"Confirmar Pago"**
4. ✅ Los tickets se imprimirán automáticamente:
   - Primero: Comanda de cocina (58mm)
   - Segundo: Ticket para cliente (80mm)

### Impresión Manual

Después de confirmar pago, si quieres reimprimir:

1. Haz clic en **"Ticket Cliente"** - imprime solo el ticket del cliente
2. Haz clic en **"Comanda Cocina"** - imprime solo la comanda

## 🔌 Arquitectura Técnica

### Flujo de Impresión

```
Juliana POS (React)
    ↓
useBluetoothPrintApp Hook (genera JSON)
    ↓
my.bluetoothprint.scheme:// (esquema URI)
    ↓
Bluetooth Print App (recibe JSON)
    ↓
Impresora Térmica Bluetooth
```

### Estructura del JSON

```json
[
  {
    "type": 0,
    "content": "Mi Texto",
    "bold": 1,
    "align": 1,
    "format": 3
  }
]
```

**Tipos:**
- `0`: Texto
- `1`: Imagen
- `2`: Código de barras
- `3`: Código QR
- `4`: HTML

**Alineación:**
- `0`: Izquierda
- `1`: Centro
- `2`: Derecha

**Formato:**
- `0`: Normal
- `1`: Altura doble
- `2`: Altura + Ancho doble
- `3`: Ancho doble
- `4`: Pequeño

## 🔧 Solución de Problemas

### "Bluetooth Print App no detectada"

**Solución:**
1. Verifica que la app está instalada en el Play Store
2. En la app, habilita **"Browser Print"** en Settings
3. Recarga Juliana POS (presiona F5)

### La impresora no aparece en Bluetooth

**Solución:**
1. Verifica que:
   - ✅ Impresora está **encendida**
   - ✅ Bluetooth de la impresora está **activo** (LED azul parpadeando)
   - ✅ Bluetooth de la tablet está **activado**
   
2. Intenta:
   - Apaga y enciende la impresora
   - Desempareја desde Android y vuelve a emparejar
   - Reinicia la tablet

### Error: "Endpoint no encontrado"

**Causa:** El servidor Node.js no está corriendo

**Solución:**
```bash
# Backend local (desarrollo)
node printer-server.js

# O despliegalo en la nube (producción)
```

### No se imprime nada

**Solución:**
1. Asegúrate que:
   - ✅ La app tiene **"Browser Print" habilitado**
   - ✅ La impresora está **emparejada a nivel Android**
   - ✅ El servidor está **corriendo**
   
2. Abre la app **Bluetooth Print** directamente para verificar
3. Intenta el endpoint de prueba: `GET /api/print/test`

### "El papel se sale sin imprimir"

**Posible causa:** Papel mal colocado o calibración

**Solución:**
1. Abre la app **Bluetooth Print**
2. Ve a **Settings** → **Printer Settings**
3. Busca **"Calibration"** y sigue las instrucciones

## 📋 Formato de Impresión

### Ticket Cliente (80mm)

```
        JULIANA
     BARRA COTIDIANA
 Av. Miguel Hidalgo #276
   Tel: 417 206 0111
==========================================
Pedido: #123
Nombre: Juan Pérez
23/02/2026 10:30
==========================================
2x Baguette Pavo y Panela    $170
1x Ensalada House            $125
==========================================
TOTAL: $295
==========================================
¡Gracias por tu visita!
Vuelve pronto
```

### Comanda Cocina (58mm)

```

      COMANDA
        #123
================================
👤 Juan Pérez
🕐 23/02/2026 10:30
================================
2X BAGUETTE PAVO Y PANELA
  Tamaño: Normal
1X ENSALADA HOUSE
================================
     PREPARAR AHORA

```

## 💡 Tips

- **Habilita Browser Print** en la app antes de intentar imprimir
- **Acerca la tablet** a la impresora si tienes problemas (máximo 10 metros)
- **Emojis** (👤, 🕐) se convierten automáticamente a texto en algunas configuraciones
- **Prueba con /api/print/test** para verificar que el servidor funciona

## 🚀 Despliegue en Producción

### Opción 1: Vercel (Recomendado para Vite)
1. Convierte `printer-server.js` a una Edge Function
2. Despliega Juliana POS + servidor en Vercel

### Opción 2: Railway / Render
1. Crea un nuevo proyecto
2. Selecciona Node.js
3. Sube `printer-server.js`
4. Configura el `PORT` en variables de entorno
5. Actualiza URLs en Juliana POS

### Opción 3: Supabase Edge Functions
1. Crea dos funciones Edge:
   - `/print/ticket`
   - `/print/kitchen`
2. Copiar lógica de `printer-server.js` a las funciones

## 📊 Comparación: Métodos de Impresión

| Feature | Bluetooth Print App | Web Bluetooth |
|---------|-------------------|----------------|
| Confiabilidad | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Facilidad setup | ⭐⭐⭐⭐ | ⭐⭐ |
| Velocidad | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Soporte impresoras | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Recomendado | ✅ SÍ | Como fallback |

## 📧 Soporte

Si tienes problemas:
- 📱 **Bluetooth Print App**: https://play.google.com/store/apps/details?id=mate.bluetoothprint  
- 📖 **Web Bluetooth Fallback**: Ver [PRINTER_SETUP.md](PRINTER_SETUP.md)
- 🐛 **Issues del proyecto**: Abre un issue en GitHub
