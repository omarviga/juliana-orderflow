import type { CartItem } from "@/types/pos";

interface PrinterConfig {
  width: number; // mm
  charsPerLine: number;
  fontSize: "small" | "medium" | "large";
}

const PRINTER_CONFIGS: Record<string, PrinterConfig> = {
  "80mm": { width: 80, charsPerLine: 42, fontSize: "medium" },
  "58mm": { width: 58, charsPerLine: 32, fontSize: "small" },
};

/**
 * Genera HTML para ticket de cliente (80mm)
 */
export function generateClientTicketHTML(
  items: CartItem[],
  total: number,
  orderNumber: number | null,
  customerName: string,
  dateStr: string
): string {
  const config = PRINTER_CONFIGS["80mm"];

  const separator = "=".repeat(config.charsPerLine);
  const lineSeparator = "-".repeat(config.charsPerLine);

  let html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: ${config.width}mm;
            line-height: 1.4;
          }
          .receipt {
            padding: 3mm;
            text-align: center;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          .header { font-weight: bold; font-size: 18px; margin-bottom: 2mm; }
          .subheader { font-size: 10px; margin-bottom: 3mm; }
          .line-sep { margin: 2mm 0; border-bottom: 1px dashed #000; }
          .item { text-align: left; font-size: 11px; margin: 1mm 0; }
          .item-detail { text-align: left; font-size: 9px; padding-left: 3mm; color: #666; }
          .total { font-weight: bold; font-size: 14px; margin: 2mm 0; }
          .bold { font-weight: bold; }
          .text-right { text-align: right; }
          .footer { font-size: 10px; margin-top: 3mm; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">JULIANA</div>
          <div class="subheader">BARRA COTIDIANA</div>
          <div class="subheader">Av. Miguel Hidalgo #276</div>
          <div class="subheader">Tel: 417 206 0111</div>
          <div class="line-sep"></div>
          <div style="text-align: left;">
            <div class="bold">Pedido: #${orderNumber || "---"}</div>
            <div class="bold">Nombre: ${customerName || "---"}</div>
            <div>${dateStr}</div>
          </div>
          <div class="line-sep"></div>
  `;

  // Items
  items.forEach((item) => {
    const itemLine = `${item.quantity}x ${item.product.name}${item.productSize ? ` (${item.productSize.name})` : ""}`;
    const priceLine = `$${item.subtotal.toFixed(0)}`;

    html += `<div class="item"><span>${itemLine}</span><span class="text-right">${priceLine}</span></div>`;

    if (item.customLabel) {
      html += `<div class="item-detail">${item.customLabel}</div>`;
    }
  });

  html += `
          <div class="line-sep"></div>
          <div class="total" style="display: flex; justify-content: space-between;">
            <span>TOTAL</span>
            <span>$${total.toFixed(0)}</span>
          </div>
          <div class="line-sep"></div>
          <div class="footer">¡Gracias por tu visita!</div>
          <div class="footer">Vuelve pronto</div>
        </div>
      </body>
    </html>
  `;

  return html;
}

/**
 * Genera HTML para comanda de cocina (58mm)
 */
export function generateKitchenOrderHTML(
  items: CartItem[],
  orderNumber: number | null,
  customerName: string,
  dateStr: string
): string {
  const config = PRINTER_CONFIGS["58mm"];
  const separator = "=".repeat(config.charsPerLine);

  let html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            font-weight: bold;
            width: ${config.width}mm;
            line-height: 1.2;
          }
          .comanda {
            padding: 2mm;
            text-align: center;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          .header {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 2mm;
            text-transform: uppercase;
          }
          .order-info {
            font-size: 11px;
            text-align: left;
            margin: 1mm 0;
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
          }
          .item {
            text-align: left;
            font-size: 13px;
            font-weight: bold;
            margin: 2mm 0;
            text-transform: uppercase;
            border-bottom: 1px dashed #000;
            padding-bottom: 1mm;
          }
          .customization {
            font-size: 12px;
            text-align: left;
            margin-left: 3mm;
            font-weight: normal;
          }
          .qty { font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="comanda">
          <div class="header">COMANDA #${orderNumber || "---"}</div>
          <div class="order-info">
            <div>👤 ${customerName || "---"}</div>
            <div>🕐 ${dateStr}</div>
          </div>
  `;

  // Items
  items.forEach((item) => {
    html += `<div class="item"><span class="qty">${item.quantity}x</span> ${item.product.name}${item.productSize ? ` (${item.productSize.name})` : ""}`.toUpperCase() + `</div>`;

    if (item.customizations && item.customizations.length > 0) {
      item.customizations.forEach((c) => {
        html += `<div class="customization">• ${c.ingredient.name}</div>`;
      });
    }

    if (item.customLabel) {
      html += `<div class="customization">📝 ${item.customLabel}</div>`;
    }
  });

  html += `
          <div style="margin-top: 3mm; border-top: 2px solid #000; padding-top: 2mm; font-size: 11px; text-align: center;">
            PREPARAR AHORA
          </div>
        </div>
      </body>
    </html>
  `;

  return html;
}

/**
 * Envía contenido a imprimir a una impresora
 */
export async function printToDevice(
  deviceAddress: string,
  htmlContent: string,
  printerSize: "80mm" | "58mm"
): Promise<void> {
  if (!navigator.bluetooth) {
    throw new Error("Web Bluetooth API no disponible en este navegador");
  }

  try {
    let device;

    // Intenta obtener el dispositivo por su dirección si has sido emparejado antes
    try {
      const pairedDevices = await navigator.bluetooth.getAvailability?.();
      if (pairedDevices) {
        // Android - intenta usar dispositivo por su dirección/ID
        device = await navigator.bluetooth.requestDevice({
          filters: [{ services: ["00001101-0000-1000-8000-00805f9b34fb"] }], // Bluetooth Serial Port Profile
          acceptAllDevices: false,
        });
      }
    } catch (e) {
      // No se pudo obtener por dirección, solicita al usuario
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ["00001101-0000-1000-8000-00805f9b34fb"] }],
        optionalServices: ["00001101-0000-1000-8000-00805f9b34fb", "0000180a-0000-1000-8000-00805f9b34fb"], // Device Information
        acceptAllDevices: false,
      });
    }

    if (!device) {
      throw new Error("No se seleccionó dispositivo");
    }

    console.log("Dispositivo Bluetooth seleccionado:", device.name, device.id);

    // Conectar a GATT
    const server = await device.gatt?.connect();
    if (!server) {
      throw new Error("No se pudo conectar a GATT server");
    }

    console.log("Conectado a GATT server");

    // Obtener servicio Serial Port Profile (UUID estándar para impresoras)
    const service = await server.getPrimaryService("00001101-0000-1000-8000-00805f9b34fb");

    // Obtener característica de escritura (hay diferentes en diferentes impresoras)
    let characteristic;
    try {
      // Intenta obtener la característica estándar
      characteristic = await service.getCharacteristic("2a19");
    } catch {
      // Si no existe, obtén cualquier característica escribible
      const characteristics = await service.getCharacteristics();
      characteristic = characteristics.find(
        (c) => c.properties.write || c.properties.writeWithoutResponse
      );

      if (!characteristic) {
        throw new Error("No se encontró característica escribible");
      }
    }

    // Convertir HTML a datos imprimibles
    const printData = htmlToEscPosCommands(htmlContent, printerSize);

    console.log("Enviando", printData.length, "bytes a la impresora");

    // Enviar datos a la impresora en chunks (Android tiene límite de 512 bytes)
    const CHUNK_SIZE = 512;
    for (let i = 0; i < printData.length; i += CHUNK_SIZE) {
      const chunk = printData.slice(i, Math.min(i + CHUNK_SIZE, printData.length));
      const buffer = new Uint8Array(chunk);

      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(buffer);
      } else {
        await characteristic.writeValue(buffer);
      }

      // Pequeña pausa entre chunks
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log("Datos enviados exitosamente");

    // Esperar un poco antes de desconectar
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Desconectar
    device.gatt?.disconnect();
    console.log("Desconectado de la impresora");
  } catch (error) {
    console.error("Error de impresión:", error);
    throw error;
  }
}

/**
 * Convierte HTML a comandos ESC/POS para impresoras térmicas
 */
function htmlToEscPosCommands(html: string, printerSize: "80mm" | "58mm"): number[] {
  const commands: number[] = [];

  // Inicializar impresora
  commands.push(0x1b, 0x40); // ESC @ - Reset

  // Configurar tamaño de fuente y área de impresión según tamaño
  if (printerSize === "58mm") {
    // Para 58mm: fuente normal
    commands.push(0x1d, 0x21, 0x00); // GS ! - Font size normal
  } else {
    // Para 80mm: fuente normal
    commands.push(0x1d, 0x21, 0x00);
  }

  // Alineación central
  commands.push(0x1b, 0x61, 0x01); // ESC a - Center alignment

  // Extraer texto del HTML
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/g, "\n")
    .replace(/<div[^>]*>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");

  // Convertir texto a bytes UTF-8
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  commands.push(...Array.from(textBytes));

  // Alineación izquierda (para cierre)
  commands.push(0x1b, 0x61, 0x00); // ESC a - Left alignment

  // Saltos de línea
  commands.push(0x0a, 0x0a, 0x0a);

  // Corte de papel (parcial)
  commands.push(0x1d, 0x56, 0x41, 0x00); // GS V - Partial cut

  // Fin de transmisión
  commands.push(0x1b, 0x69); // ESC i - Partial cut with feed

  return commands;
}

/**
 * Imprime usando la API de impresión del navegador (fallback)
 */
export function printViaBrowser(htmlContent: string, title: string = "Impresión"): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error("No se pudo abrir ventana de impresión");
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Esperar a que cargue y luego imprimir
  printWindow.onload = () => {
    printWindow.print();
  };
}
