# Sistema de Impresoras Bluetooth

Este documento explica cómo configurar y usar el sistema de impresión automática de recibos en Juliana POS.

## 🎯 Características

✅ **Impresión Automática** - Los recibos se imprimen automáticamente al confirmar pago
✅ **Bluetooth** - Conecta directamente a impresoras térmicas Bluetooth
✅ **Dos Formatos** - 80mm para cliente, 58mm para cocina
✅ **Cola de Impresión** - Gestiona múltiples impresiones en secuencia
✅ **Fallback a Web** - Imprime por navegador si falla Bluetooth
✅ **Configuración Flexible** - Personaliza comportamiento de impresión

## 📱 Impresoras Soportadas

### Cliente (80mm)
- Impresoras térmicas de 80mm
- Conectadas por Bluetooth
- Formato: Ticket estándar de cliente

### Cocina (58mm)
- Impresoras térmicas de 58mm (rollo angosto)
- Conectadas por Bluetooth
- Formato: Comanda de cocina

## ⚙️ Configuración

### 1. Emparejar Impresoras

1. En la esquina superior derecha, haz clic en el botón **"Impresoras"**
2. Se abrirá el diálogo de configuración
3. Para cada impresora:
   - Haz clic en **"Emparejar Impresora"**
   - Selecciona la impresora Bluetooth de la lista
   - Confirma el emparejamiento

### 2. Opciones de Impresión

- **Impresión automática**: Activa/desactiva impresión automática al confirmar pago
- **Usar Bluetooth**: Usa Bluetooth si está disponible
- **Fallback a navegador**: Si falla Bluetooth, intenta imprimir con el navegador

## 🖨️ Uso

### Impresión Automática (Recomendado)

1. Completa el pedido
2. Ingresa el nombre del cliente
3. Haz clic en **"Confirmar Pago"**
4. ✅ Los recibos se imprimirán automáticamente:
   - Primero: Comanda en cocina (58mm)
   - Segundo: Ticket para cliente (80mm)

### Impresión Manual

Después de confirmar el pago, si deseas reimprimir:

1. Haz clic en **"Ticket Cliente"** para imprimir solo el ticket del cliente
2. Haz clic en **"Comanda Cocina"** para imprimir solo la comanda

## 📋 Formato del Ticket Cliente (80mm)

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
2x Baguette Pavo y Panela ($85)
1x Ensalada House ($125)
==========================================
TOTAL                              $295
==========================================
  ¡Gracias por tu visita!
        Vuelve pronto
```

## 📝 Formato de Comanda Cocina (58mm)

```
COMANDA #123
================================
👤 Juan Pérez
🕐 23/02/2026 10:30
================================
2x BAGUETTE PAVO Y PANELA
   • Queso extra
1x ENSALADA HOUSE
   • Sin croutones
================================
PREPARAR AHORA
```

## 🔧 Solución de Problemas

### La impresora no aparece en la lista

1. Verifica que la impresora esté encendida
2. Asegúrate que esté en modo de emparejamiento Bluetooth
3. Intenta de nuevo

### Falla la impresión Bluetooth

1. Verifica la conexión Bluetooth del dispositivo
2. Asegúrate que la impresora está dentro del rango (10 metros)
3. Intenta con fallback a navegador (activado por defecto)

### El navegador no deja imprimir

1. Algunos navegadores restringen la impresión automática
2. Deberás dar permiso manualmente
3. O configura impresoras Bluetooth (recomendado)

## 💡 Recomendaciones

✅ Usar impresoras Bluetooth dedicadas para mejor rendimiento
✅ Activar impresión automática para agilidad
✅ Mantener impresoras cargadas/enchufadas
✅ Probar conexión antes del servicio
✅ Tener fallback a navegador como respaldo

## 📞 Soporte

Si tienes problemas con la impresión:

1. Verifica que las impresoras estén emparejadas en el diálogo de configuración
2. Revisa la consola del navegador (F12) para errores
3. Prueba con impresión manual desde el navegador
4. Desempareја y vuelve a emparejar si persiste el error
