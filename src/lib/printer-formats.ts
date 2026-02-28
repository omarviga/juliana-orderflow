// printer-format.ts - VERSIÓN CORREGIDA CON COMANDA DETALLADA Y TICKET EXACTO

import type { CartItem } from "@/types/pos";

// ============================================
// CONFIGURACIÓN BÁSICA
// ============================================

interface PrinterConfig {
  charsPerLine: number;
}

const PRINTER_CONFIGS: Record<string, PrinterConfig> = {
  "80mm": { charsPerLine: 42 },
  "58mm": { charsPerLine: 32 },
};

const STANDALONE_EXTRA_PRODUCT_NAMES = new Set([
  "EXTRA SUELTO",
  "EXTRAS SUELTOS",
  "EXTRA INDEPENDIENTE",
]);

// ============================================
// UTILIDADES
// ============================================

const normalizeText = (value: string) =>
  value.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const getDisplayProductName = (name: string) =>
  STANDALONE_EXTRA_PRODUCT_NAMES.has(normalizeText(name)) ? "Extra" : name;

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

// ============================================
// CONSTANTES ESC/POS
// ============================================

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const CMD = {
  RESET: [ESC, 0x40],
  CENTER: [ESC, 0x61, 0x01],
  LEFT: [ESC, 0x61, 0x00],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  FONT_NORMAL: [GS, 0x21, 0x00],
  FONT_LARGE: [GS, 0x21, 0x11],
  FULL_CUT: [GS, 0x56, 0x00],
  PARTIAL_CUT: [GS, 0x56, 0x01],
  OPEN_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xFA],
  OPEN_DRAWER_2: [ESC, 0x70, 0x01, 0x19, 0xFA],
  FEED: (lines: number) => [ESC, 0x64, lines],
};

const textEncoder = new TextEncoder();

function encode(text: string): number[] {
  return Array.from(textEncoder.encode(text + "\n"));
}

// ============================================
// GENERADOR DE COMANDA (PARTE 1) - CON FORMATO CORRECTO
// ============================================

export function generateKitchenOrderEscPos(
  items: CartItem[],
  orderNumber: number | null,
  customerName: string,
  dateStr: string
): number[] {
  const config = PRINTER_CONFIGS["58mm"];
  const separator = "-".repeat(config.charsPerLine) + "\n";

  const commands = [
    ...CMD.RESET,
    ...CMD.LEFT,
    ...CMD.BOLD_ON,
    ...encode(`CLIENTE: ${(customerName || "Barra").toUpperCase()}`),
    ...CMD.BOLD_OFF,
    ...encode(`Hora: ${dateStr}`),
    ...encode(separator),
  ];

  items.forEach((item) => {
    // Formato: "1X ARMA TU ENSALADA"
    commands.push(
      ...CMD.BOLD_ON,
      ...encode(`${item.quantity}X ${getDisplayProductName(item.product.name).toUpperCase()}`),
      ...CMD.BOLD_OFF
    );

    // Si tiene tamaño, mostrarlo en paréntesis en la siguiente línea
    if (item.productSize?.name) {
      commands.push(...encode(`(${item.productSize.name.toUpperCase()})`));
    }

    // Mostrar ingredientes (customizations) con guiones
    if (item.customizations && item.customizations.length > 0) {
      item.customizations.forEach((c) => {
        commands.push(...encode(`- ${c.ingredient.name.toLowerCase()}`));
      });
    }

    // Mostrar customLabel si existe con asterisco (como en el ejemplo)
    if (item.customLabel) {
      commands.push(...encode(`*${item.customLabel}`));
    }

    commands.push(LF);
  });

  commands.push(...encode(separator));
  commands.push(...CMD.CENTER, ...CMD.BOLD_ON);
  commands.push(...encode("PREPARAR YA"));
  commands.push(...CMD.BOLD_OFF);
  commands.push(LF, LF, ...CMD.FEED(3));

  // Corte PARCIAL después de la comanda
  commands.push(...CMD.PARTIAL_CUT);

  return commands;
}

// ============================================
// GENERADOR DE TICKET CLIENTE (PARTE 2) - CON FORMATO EXACTO
// ============================================

export function generateClientTicketEscPos(
  items: CartItem[],
  total: number,
  orderNumber: number | null,
  customerName: string,
  dateStr: string,
  paymentMethodLabel: string = "Efectivo",
  options?: { openDrawer?: boolean; fullCut?: boolean; drawerNumber?: 1 | 2 }
): number[] {
  const config = PRINTER_CONFIGS["80mm"];
  const separator = "-".repeat(config.charsPerLine) + "\n";
  const doubleSeparator = "=".repeat(config.charsPerLine) + "\n";

  const commands = [
    ...CMD.RESET,
    ...CMD.CENTER,
    ...CMD.FONT_LARGE,
    ...CMD.BOLD_ON,
    ...encode("Tufiana"),
    ...CMD.BOLD_OFF,
    ...CMD.FONT_NORMAL,
    ...encode("BARRA COTIDIANA"),
    ...encode("AV. MIGUEL HIDALGO #276, COL CENTRO, ACAMBARO GTO."),
    ...encode("Tel. 417 206 9111"),
    ...encode(doubleSeparator),
    ...CMD.LEFT,
    ...CMD.BOLD_ON,
    ...encode("DETALLE DEL PEDIDO"),
    ...CMD.BOLD_OFF,
    ...encode(separator),
    ...encode(`Pedido: #${orderNumber || "---"}`),
    ...encode(`Cliente: ${customerName || "Barra"}`),
    ...encode(`Fecha: ${dateStr}`),
    ...encode(`Pago: ${paymentMethodLabel}`),
    ...encode(separator),
    ...CMD.BOLD_ON,
    ...encode("CONSUMO"),
    ...CMD.BOLD_OFF,
    ...encode(separator),
  ];

  items.forEach((item) => {
    // Formato: "- 1x Campesina"
    const itemLine = `- ${item.quantity}x ${getDisplayProductName(item.product.name)}`;
    commands.push(...CMD.BOLD_ON, ...encode(itemLine), ...CMD.BOLD_OFF);

    // Si tiene tamaño, mostrarlo
    if (item.productSize?.name) {
      commands.push(...encode(`  (${item.productSize.name})`));
    }

    // Detalles/Sin extras
    if (item.customLabel) {
      commands.push(...encode(`  - ${item.customLabel}`));
    } else if (item.kitchenNote) {
      commands.push(...encode(`  - ${item.kitchenNote}`));
    } else {
      commands.push(...encode(`  - Sin extras`));
    }

    // Precio
    const priceLine = `  - $${item.subtotal.toFixed(0)}`;
    commands.push(...encode(priceLine));
  });

  commands.push(...encode(doubleSeparator));
  commands.push(...CMD.CENTER, ...CMD.FONT_LARGE, ...CMD.BOLD_ON);
  commands.push(...encode("TOTAL"));
  commands.push(...encode(`$${total.toFixed(0)}`));
  commands.push(...CMD.BOLD_OFF, ...CMD.FONT_NORMAL);
  commands.push(...encode(doubleSeparator));
  commands.push(...CMD.CENTER);
  commands.push(...encode("GRACIAS POR VISITARNOS"));
  commands.push(LF, LF);

  if (options?.openDrawer) {
    commands.push(...(options.drawerNumber === 2 ? CMD.OPEN_DRAWER_2 : CMD.OPEN_DRAWER));
  }

  commands.push(...CMD.FEED(3));

  // Corte COMPLETO al final del ticket
  commands.push(...CMD.FULL_CUT);

  return commands;
}

// ============================================
// FUNCIÓN PARA IMPRIMIR AMBOS (COMANDA + TICKET)
// ============================================

export function generateBothEscPos(
  items: CartItem[],
  total: number,
  orderNumber: number | null,
  customerName: string,
  dateStr: string,
  paymentMethodLabel: string = "Efectivo",
  options?: {
    openDrawer?: boolean;
    drawerNumber?: 1 | 2;
  }
): number[] {
  // Primero generar la comanda (con corte parcial al final)
  const kitchenCommands = generateKitchenOrderEscPos(
    items,
    orderNumber,
    customerName,
    dateStr
  );

  // Luego generar el ticket del cliente (con corte completo al final)
  const clientCommands = generateClientTicketEscPos(
    items,
    total,
    orderNumber,
    customerName,
    dateStr,
    paymentMethodLabel,
    {
      openDrawer: options?.openDrawer,
      fullCut: true,
      drawerNumber: options?.drawerNumber
    }
  );

  // Combinar comandos: comanda + ticket
  return [...kitchenCommands, ...clientCommands];
}

// ============================================
// FUNCIONES PARA ESC/POS PRINT SERVICE
// ============================================

export interface PrintPayload {
  commands: number[];
  config?: {
    feedLines?: number;
    autoCut?: 'full' | 'partial';
    cashDrawer?: {
      drawerNumber: 1 | 2;
      pulseOn?: number;
      pulseOff?: number;
    };
  };
}

export function buildEscPosAppUrl(macAddress: string, payload: PrintPayload): string {
  const { commands, config = {} } = payload;
  const {
    feedLines = 2,
    autoCut = 'full',
    cashDrawer,
  } = config;

  // Convertir comandos a texto plano para HTML
  const text = commands
    .map((byte) => {
      if (byte === 0x0a) return "\n";
      if (byte < 0x20 || byte > 0x7e) return "";
      return String.fromCharCode(byte);
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Obtener URL base correcta para el logo
  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:8080";
  const logoUrl = `${baseUrl}/juliana-logo.png`;

  // Detectar si es comanda (tiene "CLIENTE:" al inicio)
  const isKitchen = text.includes("CLIENTE:") && !text.includes("Tufiana");

  // Escapar texto para HTML
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  let html = "";

  if (isKitchen) {
    // HTML para COMANDA
    html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: white; 
      font-family: 'Courier New', monospace;
      padding: 15px;
    }
    .ticket {
      width: 58mm;
      background: white;
      border: 1px solid #000;
      border-radius: 8px;
      padding: 12px;
    }
    .header {
      font-weight: bold;
      margin-bottom: 8px;
    }
    .separator {
      border-top: 1px dashed #000;
      margin: 8px 0;
    }
    .item {
      margin: 5px 0;
    }
    .item-name {
      font-weight: bold;
      font-size: 14px;
    }
    .ingredient {
      margin-left: 10px;
      font-size: 12px;
    }
    .footer {
      text-align: center;
      font-weight: bold;
      margin-top: 10px;
    }
    pre { display: none; }
  </style>
</head>
<body>
  <div class="ticket">
    ${escapedText.split('<br>').map(line => {
      if (line.includes('CLIENTE:')) {
        return `<div class="header">${line}</div>`;
      }
      if (line.includes('Hora:')) {
        return `<div>${line}</div>`;
      }
      if (line === '-'.repeat(32)) {
        return `<div class="separator"></div>`;
      }
      if (line.includes('X ')) {
        return `<div class="item-name">${line}</div>`;
      }
      if (line.startsWith('(')) {
        return `<div>${line}</div>`;
      }
      if (line.startsWith('- ')) {
        return `<div class="ingredient">${line}</div>`;
      }
      if (line.startsWith('*')) {
        return `<div class="ingredient" style="font-style:italic">${line}</div>`;
      }
      if (line.includes('PREPARAR YA')) {
        return `<div class="footer">${line}</div>`;
      }
      return `<div>${line}</div>`;
    }).join('')}
  </div>
</body>
</html>`;
  } else {
    // HTML para TICKET CLIENTE (igual que antes)
    html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: white; 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      display: flex;
      justify-content: center;
      padding: 20px;
    }
    .ticket {
      width: 80mm;
      background: white;
      border: 2px solid #000;
      border-radius: 16px;
      padding: 20px 15px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .logo-container {
      text-align: center;
      margin-bottom: 15px;
    }
    .logo {
      max-width: 180px;
      height: auto;
      display: inline-block;
    }
    .business-name {
      text-align: center;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 1px;
      margin: 5px 0 2px;
      text-transform: uppercase;
    }
    .business-subtitle {
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 1px;
      margin-bottom: 10px;
      text-transform: uppercase;
    }
    .business-address {
      text-align: center;
      font-size: 11px;
      color: #333;
      line-height: 1.4;
      margin-bottom: 15px;
    }
    .double-line {
      border-top: 3px double #000;
      margin: 15px 0;
    }
    .single-line {
      border-top: 1px solid #000;
      margin: 10px 0;
    }
    .section-title {
      font-weight: 700;
      font-size: 14px;
      text-transform: uppercase;
      margin: 10px 0 5px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      font-size: 12px;
    }
    .info-label {
      font-weight: 500;
    }
    .info-value {
      font-weight: 700;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      font-weight: 700;
      margin: 8px 0 2px;
      font-size: 13px;
    }
    .item-detail {
      font-size: 11px;
      color: #555;
      margin-left: 10px;
      margin-bottom: 8px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 22px;
      font-weight: 800;
      margin: 15px 0;
      padding: 10px 0;
    }
    .total-label {
      text-transform: uppercase;
    }
    .total-amount {
      font-size: 24px;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 15px;
    }
    pre { display: none; }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="logo-container">
      <img class="logo" src="${logoUrl}" alt="Tufiana" onerror="this.style.display='none'">
    </div>
    
    <div class="business-name">Tufiana</div>
    <div class="business-subtitle">BARRA COTIDIANA</div>
    <div class="business-address">
      AV. MIGUEL HIDALGO #276, COL CENTRO,<br>
      ACAMBARO GTO.<br>
      Tel. 417 206 9111
    </div>

    <div class="double-line"></div>

    <div class="section-title">DETALLE DEL PEDIDO</div>
    
    <div class="single-line"></div>

    ${text.split('\n').map(line => {
      if (line.includes('Pedido:')) {
        const [_, value] = line.split(':');
        return `<div class="info-row"><span class="info-label">Pedido</span><strong class="info-value">${value}</strong></div>`;
      }
      if (line.includes('Cliente:')) {
        const [_, value] = line.split(':');
        return `<div class="info-row"><span class="info-label">Cliente</span><strong class="info-value">${value}</strong></div>`;
      }
      if (line.includes('Fecha:')) {
        const [_, value] = line.split(':');
        return `<div class="info-row"><span class="info-label">Fecha</span><span class="info-value">${value}</span></div>`;
      }
      if (line.includes('Pago:')) {
        const [_, value] = line.split(':');
        return `<div class="info-row"><span class="info-label">Pago</span><strong class="info-value">${value}</strong></div>`;
      }
      if (line.includes('CONSUMO')) {
        return `<div class="double-line"></div><div class="section-title">CONSUMO</div><div class="single-line"></div>`;
      }
      if (line.includes('- ') && line.includes('x ')) {
        return `<div class="item-row"><span>${line}</span></div>`;
      }
      if (line.includes('  - ') && !line.includes('$')) {
        return `<div class="item-detail">${line.trim()}</div>`;
      }
      if (line.includes('  - $')) {
        return `<div class="item-detail" style="font-weight:bold">${line.trim()}</div>`;
      }
      if (line.includes('TOTAL')) {
        return `<div class="double-line"></div>`;
      }
      if (line.includes('$') && !line.includes('-')) {
        return `<div class="total-row"><span class="total-label">TOTAL</span><span class="total-amount">${line.trim()}</span></div>`;
      }
      if (line.includes('GRACIAS')) {
        return `<div class="double-line"></div><div class="footer">${line.trim()}</div>`;
      }
      return '';
    }).filter(Boolean).join('\n')}
  </div>
</body>
</html>`;
  }

  const src = `data:text/html,${encodeURIComponent(html)}`;

  const params = new URLSearchParams();
  params.set("srcTp", "uri");
  params.set("srcObj", "html");
  params.set("numCopies", "1");
  params.set("src", src);
  params.set("feed", String(feedLines));
  params.set("cut", autoCut);
  params.set("drawer", cashDrawer ? "1" : "0");
  params.set("size", isKitchen ? "58mm" : "80mm");

  return `print://escpos.org/escpos/bt/print?${params.toString()}`;
}

export function isEscPosAppAvailable(): boolean {
  return isAndroid();
}

export async function printToEscPosApp(
  macAddress: string,
  commands: number[],
  options?: {
    feedLines?: number;
    autoCut?: 'full' | 'partial';
    openDrawer?: boolean;
    drawerNumber?: 1 | 2;
  }
): Promise<boolean> {
  if (!isAndroid()) {
    console.error("ESC/POS PrintService solo disponible en Android");
    return false;
  }

  try {
    const url = buildEscPosAppUrl(macAddress, {
      commands,
      config: {
        feedLines: options?.feedLines || 2,
        autoCut: options?.autoCut || 'full',
        cashDrawer: options?.openDrawer ? {
          drawerNumber: options.drawerNumber || 2,
          pulseOn: 50,
          pulseOff: 250
        } : undefined
      }
    });

    console.log("📤 Abriendo URL:", url);
    window.location.href = url;
    return true;
  } catch (error) {
    console.error("❌ Error al abrir ESC/POS PrintService:", error);
    return false;
  }
}

// ============================================
// FUNCIONES DE ALTO NIVEL
// ============================================

export async function printClientTicketEscPos(
  macAddress: string,
  items: CartItem[],
  total: number,
  orderNumber: number | null,
  customerName: string,
  dateStr: string,
  paymentMethodLabel: string = "Efectivo",
  options?: {
    openDrawer?: boolean;
    fullCut?: boolean;
    drawerNumber?: 1 | 2;
  }
): Promise<boolean> {
  const commands = generateClientTicketEscPos(
    items, total, orderNumber, customerName, dateStr, paymentMethodLabel,
    { openDrawer: options?.openDrawer, fullCut: options?.fullCut, drawerNumber: options?.drawerNumber }
  );

  return printToEscPosApp(macAddress, commands, {
    feedLines: 2,
    autoCut: options?.fullCut ? 'full' : 'partial',
    openDrawer: options?.openDrawer,
    drawerNumber: options?.drawerNumber || 2
  });
}

export async function printKitchenOrderEscPos(
  macAddress: string,
  items: CartItem[],
  orderNumber: number | null,
  customerName: string,
  dateStr: string
): Promise<boolean> {
  const commands = generateKitchenOrderEscPos(items, orderNumber, customerName, dateStr);
  return printToEscPosApp(macAddress, commands, {
    feedLines: 2,
    autoCut: 'partial',
    openDrawer: false
  });
}

export async function printBothEscPos(
  macAddress: string,
  items: CartItem[],
  total: number,
  orderNumber: number | null,
  customerName: string,
  dateStr: string,
  paymentMethodLabel: string = "Efectivo",
  options?: {
    openDrawer?: boolean;
    drawerNumber?: 1 | 2;
  }
): Promise<boolean> {
  const commands = generateBothEscPos(
    items, total, orderNumber, customerName, dateStr, paymentMethodLabel,
    { openDrawer: options?.openDrawer, drawerNumber: options?.drawerNumber }
  );

  return printToEscPosApp(macAddress, commands, {
    feedLines: 2,
    autoCut: 'full',
    openDrawer: options?.openDrawer,
    drawerNumber: options?.drawerNumber || 2
  });
}

// ============================================
// FUNCIONES DE COMPATIBILIDAD (NO USAR)
// ============================================

export async function printToDevice(
  deviceAddress: string,
  htmlContent: string,
  printerSize: "80mm" | "58mm",
  options?: { openDrawer?: boolean; fullCut?: boolean }
): Promise<void> {
  throw new Error("printToDevice no soportado - usa printClientTicketEscPos directamente");
}

export async function printMultipleToDevice(
  deviceAddress: string,
  jobs: Array<{
    htmlContent?: string;
    escPosCommands?: number[];
    printerSize: "80mm" | "58mm";
    options?: { openDrawer?: boolean; fullCut?: boolean };
  }>
): Promise<void> {
  throw new Error("printMultipleToDevice no soportado - usa printBothEscPos directamente");
}

export function printViaBrowser(): void {
  throw new Error("printViaBrowser deshabilitado");
}

export function generateClientTicketHTML(
  items: CartItem[],
  total: number,
  orderNumber: number | null,
  customerName: string,
  dateStr: string,
  paymentMethodLabel: string = "Efectivo"
): string {
  throw new Error("generateClientTicketHTML no soportado - usa generateClientTicketEscPos");
}

export function generateKitchenOrderHTML(
  items: CartItem[],
  orderNumber: number | null,
  customerName: string,
  dateStr: string
): string {
  throw new Error("generateKitchenOrderHTML no soportado - usa generateKitchenOrderEscPos");
}