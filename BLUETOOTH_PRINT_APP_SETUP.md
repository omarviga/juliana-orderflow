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

### Paso 2: Preparar la Impresora

1. **Enciende la impresora térmica**
2. **Activa el modo Bluetooth** (usualmente presionando el botón 3-5 segundos)
   - Busca una luz LED azul parpadeando
3. **Espera 30 segundos** a que entre en modo descubierta

### Paso 3: Emparejar en Android

1. Ve a **Configuración → Bluetooth**
2. Activa **Bluetooth**
3. Busca y selecciona tu impresora (ej: "PROVA_THERMAL", "EPSON-TM", "XPrinter")
4. Completa el emparejamiento (puede pedir PIN: prueba `0000` o `1234`)
5. Deberías ver la impresora como **"Conectada"**

### Paso 4: Nada Más

¡Eso es todo! Juliana POS detectará automáticamente que Bluetooth Print App está instalada y la usará.

## 🖨️ Uso

### Impresión Automática

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

## 🔧 Formato de Impresión

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

## ❌ Solución de Problemas

### "Bluetooth Print App no disponible"

**Solución:**
1. Verifica que la app está instalada en el Play Store
2. Recarga Juliana POS (presiona F5 o recarga la página)
3. Intenta nuevamente

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

### No se imprime nada

**Solución:**
1. Asegúrate de que la impresora está **emparejada a nivel Android**
2. Abre la app **Bluetooth Print** directamente para verificar que funciona
3. Intenta imprimir algo desde la app Bluetooth Print
4. Si funciona desde la app pero no desde Juliana, recarga la página

### "El papel se sale sin imprimir"

**Posible causa:** Papel mal colocado o calibración

**Solución:**
1. Abre la app **Bluetooth Print**
2. Accede a **Configuración**
3. Busca **"Printer Settings"** o **"Calibration"**
4. Sigue las instrucciones para calibrar

## 💡 Tips

- **Deja la app Bluetooth Print abierta** la primera vez para debugging
- **Los emojis** (👤, 🕐) se convierten automáticamente a texto si tienes activada esa opción en la app
- **Acerca la tablet** a la impresora si tienes problemas de conexión (máximo 10 metros)

## 🆚 Comparación: Bluetooth Print App vs Web Bluetooth

| Feature | Bluetooth Print App | Web Bluetooth |
|---------|-------------------|----------------|
| Confiabilidad | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Facilidad setup | ⭐⭐⭐⭐ | ⭐⭐ |
| Velocidad | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Soporte impresoras | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Recomendado | ✅ SÍ | Como fallback |

## 📧 Soporte

Si tienes problemas que no puedes resolver:
- Contacta a Mate Technologies: https://play.google.com/store/apps/details?id=mate.bluetoothprint
- Revisa el [PRINTER_SETUP.md](PRINTER_SETUP.md) para Web Bluetooth como alternativa
