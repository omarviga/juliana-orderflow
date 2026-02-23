# Guía: Conectar Impresora Bluetooth a Tablet Android

## 🔧 Requisitos
- Tablet Android 5.0 o superior
- Navegador Chrome (versión 56+) o Edge
- Impresora térmica Bluetooth (80mm o 58mm)
- Bluetooth habilitado en la tablet

## 📱 Paso 1: Preparar la Tabla Android

1. **Abre Configuración**
2. **Ve a Bluetooth**
3. **Activa el Bluetooth**
4. Asegúrate que la tablet sea **"Visible"** o **"Detectable"**

## 🖨️ Paso 2: Preparar la Impresora

1. **Enciende la impresora**
2. **Activa el modo Bluetooth** (usualmente presionando el botón durante 3-5 segundos)
   - Busca una luz LED azul parpadeando (indica modo emparejamiento)
3. **Espera 30 segundos** a que entre en modo descubierta

## 🔗 Paso 3: Emparejar en Android

1. Desde **Configuración → Bluetooth → Dispositivos disponibles**
2. Busca tu impresora (ej: "PROVA_THERMAL", "EPSON-TM", "XPrinter")
3. **Toca el nombre** para conectar
4. Es posible que pida un **PIN** (prueba: **0000** o **1234**)
5. **Confirma** cuando se haya emparejado

✅ Deberías ver la impresora como **"Conectada"** en tu lista de dispositivos Bluetooth

## 💻 Paso 4: Usar Juliana POS

1. **Abre Chrome** y ve a tu aplicación Juliana POS
2. En la esquina superior derecha, haz clic en **"Impresoras"**
3. En el diálogo, haz clic en **"Emparejar Impresora"** (para 80mm o 58mm)
4. Selecciona tu impresora de la lista que aparece
5. **Confirma** el emparejamiento

✅ Deberías ver "✓ Conectada" junto a tu impresora

## 🖥️ Paso 5: Probar Impresión

1. Haz una orden de prueba
2. Ingresa el nombre de cliente
3. Haz clic en **"Confirmar Pago"**
4. La impresora debería imprimir automáticamente

## ❌ Solución de Problemas

### La impresora no aparece en la lista de Chrome

**Solución:**
1. Verifica que:
   - ✅ Impresora está **emparejada** a nivel Android
   - ✅ Impresora está **encendida**
   - ✅ Impresora está **dentro del rango** (< 10 metros)
   - ✅ Bluetooth de la tablet está activo

2. Intenta:
   - Recarga la página (Ctrl+R)
   - Reinicia la impresora
   - Desempareја y vuelve a emparejar desde Android
   - Abre y cierra Bluetooth en la tablet

### "Permiso denegado" o "NotAllowedError"

**Solución:**
1. Ve a **Configuración → Aplicaciones → Chrome**
2. Busca **Permisos → Bluetooth**
3. Asegúrate de que sea **Permitido**
4. Recarga la página

### "NotFoundError" - No se encuentran impresoras

**Solución:**
1. Verifica que la impresora esté en **modo emparejamiento**
2. Intenta nuevamente desde 0:
   - Desempareја en Android
   - Apaga la impresora
   - Enciéndela
   - Activa modo Bluetooth
   - Empareја desde Android
   - Intenta en Juliana POS

### La impresora se conecta pero no imprime

**Solución:**
1. Verifica:
   - ✅ Hay papel en la impresora
   - ✅ La impresora tiene batería/está enchufada
   - ✅ El corte de papel no está bloqueado

2. Intenta reimprimir:
   - Después de confirmar pago, haz clic en **"Ticket Cliente"** o **"Comanda Cocina"**
   - Prueba con impresión manual desde el navegador (fallback)

## 📋 Información Técnica

- **Protocolo**: Bluetooth Serial Port Profile (SPP)
- **Comandos**: ESC/POS (estándar de impresoras térmicas)
- **Tamaños**: 80mm (cliente) y 58mm (cocina)
- **Chunking**: Se envían en bloques de 512 bytes

## 💡 Consejos

✅ **Empareja primero en Android**, luego en la app
✅ Mantén la tablet y impresora **cerca** (< 10 metros)
✅ Evita obstáculos entre dispositivos
✅ Si falla Bluetooth, la app imprime por navegador automáticamente
✅ Prueba la conexión **antes** de comenzar servicio

## 📞 Si persisten los problemas

1. Abre la **Consola del navegador** (F12 → Consola)
2. Intenta emparejar de nuevo
3. Copia los errores que ves
4. Contacta soporte con esa información
