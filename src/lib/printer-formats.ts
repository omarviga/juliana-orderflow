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
  // En navegadores, usamos la API de Web Bluetooth
  if (!navigator.bluetooth) {
    throw new Error("Web Bluetooth API no disponible en este navegador");
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: "" }], // Filter by name if known
    });

    if (!device) {
      throw new Error("No se seleccionó dispositivo");
    }

    // Conectar a GATT
    const server = await device.gatt?.connect();
    if (!server) {
      throw new Error("No se pudo conectar a GATT server");
    }

    // Obtener servicio de impresión (UUID estándar de impresoras térmicas)
    const service = await server.getPrimaryService("00001101-0000-1000-8000-00805f9b34fb");
    const characteristic = await service.getCharacteristic(
      "00001101-0000-1000-8000-00805f9b34fb"
    );

    // Convertir HTML a datos imprimibles
    const printData = htmlToEscPosCommands(htmlContent, printerSize);

    // Enviar datos a la impresora
    await characteristic.writeValue(new Uint8Array(printData));

    // Desconectar
    await device.gatt?.disconnect();
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

  // Configurar tamaño de fuente y área de impresión
  if (printerSize === "58mm") {
    commands.push(0x1b, 0x57, 0x06, 0x00); // Ancho de 58mm
    commands.push(0x1d, 0x21, 0x11); // Font size 17
  } else {
    commands.push(0x1b, 0x57, 0x06, 0x00); // Ancho de 80mm
    commands.push(0x1d, 0x21, 0x00); // Font normal
  }

  // Extraer texto del HTML (simplificado)
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  // Convertir texto a bytes UTF-8
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  commands.push(...Array.from(textBytes));

  // Salto de línea y corte de papel
  commands.push(0x0a, 0x0a, 0x0a);
  commands.push(0x1d, 0x56, 0x42, 0x00); // Partial cut

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
