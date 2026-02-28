// printer-format.ts - VERSIÓN COMPLETA Y CORREGIDA CON TODOS LOS COMANDOS ESC/POS

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

// ============================================
// CONSTANTES ESC/POS COMPLETAS
// ============================================

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const CR = 0x0d;
const NUL = 0x00;

const CMD = {
  // Inicialización
  RESET: [ESC, 0x40],                     // ESC @

  // Alineación
  LEFT: [ESC, 0x61, 0x00],                 // ESC a n (0=left)
  CENTER: [ESC, 0x61, 0x01],               // ESC a n (1=center)
  RIGHT: [ESC, 0x61, 0x02],                 // ESC a n (2=right)

  // Estilo de texto
  BOLD_ON: [ESC, 0x45, 0x01],               // ESC E n (1=bold on)
  BOLD_OFF: [ESC, 0x45, 0x00],               // ESC E n (0=bold off)

  // Tamaño de fuente
  FONT_NORMAL: [GS, 0x21, 0x00],            // GS ! n (0=normal)
  FONT_DOUBLE_HEIGHT: [GS, 0x21, 0x01],      // GS ! n (1=double height)
  FONT_DOUBLE_WIDTH: [GS, 0x21, 0x10],       // GS ! n (16=double width)
  FONT_LARGE: [GS, 0x21, 0x11],              // GS ! n (17=double height & width)

  // Corte de papel
  FULL_CUT: [GS, 0x56, 0x00],                // GS V m (0=full cut)
  PARTIAL_CUT: [GS, 0x56, 0x01],             // GS V m (1=partial cut)

  // Abrir cajón
  OPEN_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xFA],  // ESC p m t1 t2 (m=0 drawer 1)
  OPEN_DRAWER_2: [ESC, 0x70, 0x01, 0x19, 0xFA], // ESC p m t1 t2 (m=1 drawer 2)

  // Alimentar papel
  FEED: (lines: number) => [ESC, 0x64, lines],  // ESC d n

  // Línea de puntos
  DASH_LINE: (count: number) => {
    const line = "-".repeat(count) + "\n";
    return Array.from(textEncoder.encode(line));
  },

  // Línea doble
  DOUBLE_LINE: (count: number) => {
    const line = "=".repeat(count) + "\n";
    return Array.from(textEncoder.encode(line));
  },

  // Saltos de línea
  LINE_FEED: [LF],
  LINE_FEED_2: [LF, LF],
  LINE_FEED_3: [LF, LF, LF],
};

const textEncoder = new TextEncoder();

function encode(text: string): number[] {
  return Array.from(textEncoder.encode(text + "\n"));
}

// ============================================
// GENERADOR DE COMANDA (PARTE 1) - COMPLETO
// ============================================

export function generateKitchenOrderEscPos(
  items: CartItem[],
  orderNumber: number | null,
  customerName: string,
  dateStr: string
): number[] {
  const config = PRINTER_CONFIGS["58mm"];
  const separator = "-".repeat(config.charsPerLine);
  const commands: number[] = [];

  // Inicializar impresora
  commands.push(...CMD.RESET);

  // Cliente y hora
  commands.push(...CMD.LEFT);
  commands.push(...CMD.BOLD_ON);
  commands.push(...encode(`CLIENTE: ${(customerName || "Barra").toUpperCase()}`));
  commands.push(...CMD.BOLD_OFF);
  commands.push(...encode(`Hora: ${dateStr}`));

  // Línea separadora
  commands.push(...encode(separator));

  // Items
  items.forEach((item) => {
    // Nombre del producto en mayúsculas y negrita
    commands.push(...CMD.BOLD_ON);
    commands.push(...encode(`${item.quantity}X ${getDisplayProductName(item.product.name).toUpperCase()}`));
    commands.push(...CMD.BOLD_OFF);

    // Tamaño si existe
    if (item.productSize?.name) {
      commands.push(...encode(`(${item.productSize.name.toUpperCase()})`));
    }

    // Ingredientes (customizations)
    if (item.customizations && item.customizations.length > 0) {
      item.customizations.forEach((c) => {
        commands.push(...encode(`- ${c.ingredient.name.toLowerCase()}`));
      });
    }

    // CustomLabel si existe (con asterisco)
    if (item.customLabel) {
      commands.push(...encode(`*${item.customLabel}`));
    }

    commands.push(LF);
  });

  // Línea separadora final
  commands.push(...encode(separator));

  // "PREPARAR YA" centrado y negrita
  commands.push(...CMD.CENTER);
  commands.push(...CMD.BOLD_ON);
  commands.push(...encode("PREPARAR YA"));
  commands.push(...CMD.BOLD_OFF);

  // Alimentar papel y corte parcial
  commands.push(...CMD.FEED(3));
  commands.push(...CMD.PARTIAL_CUT);

  return commands;
}

// ============================================
// GENERADOR DE TICKET CLIENTE - COMPLETO
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
  const separator = "-".repeat(config.charsPerLine);
  const doubleSeparator = "=".repeat(config.charsPerLine);
  const commands: number[] = [];

  // Inicializar impresora
  commands.push(...CMD.RESET);

  // Encabezado centrado
  commands.push(...CMD.CENTER);

  // Logo (texto "Tufiana" grande)
  commands.push(...CMD.FONT_LARGE);
  commands.push(...CMD.BOLD_ON);
  commands.push(...encode("Tufiana"));
  commands.push(...CMD.BOLD_OFF);

  // Subtítulo
  commands.push(...CMD.FONT_NORMAL);
  commands.push(...encode("BARRA COTIDIANA"));

  // Dirección y teléfono
  commands.push(...encode("AV. MIGUEL HIDALGO #276, COL CENTRO, ACAMBARO GTO."));
  commands.push(...encode("Tel. 417 206 9111"));

  // Línea doble
  commands.push(...encode(doubleSeparator));

  // Detalle del pedido (izquierda)
  commands.push(...CMD.LEFT);
  commands.push(...CMD.BOLD_ON);
  commands.push(...encode("DETALLE DEL PEDIDO"));
  commands.push(...CMD.BOLD_OFF);
  commands.push(...encode(separator));

  // Información del pedido
  commands.push(...encode(`Pedido: #${orderNumber || "---"}`));
  commands.push(...encode(`Cliente: ${customerName || "Barra"}`));
  commands.push(...encode(`Fecha: ${dateStr}`));
  commands.push(...encode(`Pago: ${paymentMethodLabel}`));
  commands.push(...encode(separator));

  // Sección CONSUMO
  commands.push(...CMD.BOLD_ON);
  commands.push(...encode("CONSUMO"));
  commands.push(...CMD.BOLD_OFF);
  commands.push(...encode(separator));

  // Items
  items.forEach((item) => {
    // Línea del item con guión
    commands.push(...CMD.BOLD_ON);
    commands.push(...encode(`- ${item.quantity}x ${getDisplayProductName(item.product.name)}`));
    commands.push(...CMD.BOLD_OFF);

    // Tamaño si existe
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
    commands.push(...encode(`  - $${item.subtotal.toFixed(0)}`));
  });

  // Línea doble antes del total
  commands.push(...encode(doubleSeparator));

  // TOTAL centrado y grande
  commands.push(...CMD.CENTER);
  commands.push(...CMD.FONT_LARGE);
  commands.push(...CMD.BOLD_ON);
  commands.push(...encode("TOTAL"));
  commands.push(...encode(`$${total.toFixed(0)}`));
  commands.push(...CMD.BOLD_OFF);
  commands.push(...CMD.FONT_NORMAL);

  // Línea doble
  commands.push(...encode(doubleSeparator));

  // Gracias
  commands.push(...CMD.CENTER);
  commands.push(...encode("GRACIAS POR VISITARNOS"));
  commands.push(...CMD.LINE_FEED_2);

  // Abrir cajón si es necesario
  if (options?.openDrawer) {
    commands.push(...(options.drawerNumber === 2 ? CMD.OPEN_DRAWER_2 : CMD.OPEN_DRAWER));
  }

  // Alimentar papel y corte
  commands.push(...CMD.FEED(3));
  commands.push(...CMD.FULL_CUT);

  return commands;
}

// ============================================
// FUNCIÓN PARA IMPRIMIR AMBOS
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
  const kitchenCommands = generateKitchenOrderEscPos(items, orderNumber, customerName, dateStr);
  const clientCommands = generateClientTicketEscPos(items, total, orderNumber, customerName, dateStr, paymentMethodLabel, {
    openDrawer: options?.openDrawer,
    fullCut: true,
    drawerNumber: options?.drawerNumber
  });

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

  // Convertir comandos a base64 correctamente
  const uint8Array = new Uint8Array(commands);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  const commandsBase64 = btoa(binary);

  // Construir URL con el formato que espera la app
  const params = new URLSearchParams();
  params.set("commands", commandsBase64);
  params.set("feed", String(feedLines));
  params.set("cut", autoCut);

  if (cashDrawer) {
    params.set("drawer", cashDrawer.drawerNumber.toString());
    params.set("pulseOn", String(cashDrawer.pulseOn || 50));
    params.set("pulseOff", String(cashDrawer.pulseOff || 250));
  }

  return `print://escpos.org/escpos/bt/${macAddress}?${params.toString()}`;
}

export function isEscPosAppAvailable(): boolean {
  return isAndroid();
}

function buildEscPosHtmlUrl(
  html: string,
  options?: { feedLines?: number; autoCut?: "full" | "partial"; openDrawer?: boolean }
): string {
  const params = new URLSearchParams();
  params.set("srcTp", "uri");
  params.set("srcObj", "html");
  params.set("numCopies", "1");
  params.set("src", `data:text/html,${encodeURIComponent(html)}`);
  params.set("feed", String(options?.feedLines ?? 3));
  params.set("cut", options?.autoCut ?? "partial");
  params.set("drawer", options?.openDrawer ? "1" : "0");
  params.set("size", "80mm");
  return `print://escpos.org/escpos/bt/print?${params.toString()}`;
}

async function printHtmlToEscPosApp(
  html: string,
  options?: { feedLines?: number; autoCut?: "full" | "partial"; openDrawer?: boolean }
): Promise<boolean> {
  if (!isAndroid()) return false;
  try {
    const url = buildEscPosHtmlUrl(html, options);
    window.location.href = url;
    return true;
  } catch (error) {
    console.error("Error al abrir impresión HTML ESC/POS:", error);
    return false;
  }
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
    drawerNumber?: 1 | 2;
  }
): Promise<boolean> {
  const html = generateClientTicketHTML(
    items,
    total,
    orderNumber,
    customerName,
    dateStr,
    paymentMethodLabel
  );
  const htmlOk = await printHtmlToEscPosApp(html, {
    feedLines: 3,
    autoCut: "full",
    openDrawer: options?.openDrawer,
  });
  if (htmlOk) return true;

  const commands = generateClientTicketEscPos(
    items, total, orderNumber, customerName, dateStr, paymentMethodLabel,
    { openDrawer: options?.openDrawer, fullCut: true, drawerNumber: options?.drawerNumber }
  );

  return printToEscPosApp(macAddress, commands, {
    feedLines: 2,
    autoCut: 'full',
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
  const html = generateKitchenOrderHTML(items, orderNumber, customerName, dateStr);
  const htmlOk = await printHtmlToEscPosApp(html, {
    feedLines: 2,
    autoCut: "partial",
    openDrawer: false,
  });
  if (htmlOk) return true;

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
  const kitchenHtml = generateKitchenOrderHTML(items, orderNumber, customerName, dateStr);
  const clientHtml = generateClientTicketHTML(
    items,
    total,
    orderNumber,
    customerName,
    dateStr,
    paymentMethodLabel
  );
  const combinedHtml = `${kitchenHtml}<div style="page-break-after: always;"></div>${clientHtml}`;
  const htmlOk = await printHtmlToEscPosApp(combinedHtml, {
    feedLines: 3,
    autoCut: "full",
    openDrawer: options?.openDrawer,
  });
  if (htmlOk) return true;

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
// FUNCIONES DE COMPATIBILIDAD (MÍNIMAS)
// ============================================

export async function printToDevice(
  deviceAddress: string,
  htmlContent: string,
  printerSize: "80mm" | "58mm",
  options?: { openDrawer?: boolean; fullCut?: boolean }
): Promise<void> {
  void deviceAddress;
  void printerSize;
  const ok = await printHtmlToEscPosApp(htmlContent, {
    feedLines: 2,
    autoCut: options?.fullCut ? "full" : "partial",
    openDrawer: options?.openDrawer,
  });
  if (!ok) throw new Error("No se pudo imprimir por ESC/POS Print Service");
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
  void deviceAddress;
  const pages = jobs
    .map((job) => job.htmlContent?.trim())
    .filter((value): value is string => Boolean(value && value.length > 0));

  if (pages.length === 0) {
    throw new Error("No hay contenido HTML para imprimir");
  }

  const combinedHtml = pages.join('<div style="page-break-after: always;"></div>');
  const openDrawer = jobs.some((job) => job.options?.openDrawer);
  const fullCut = jobs.some((job) => job.options?.fullCut);
  const ok = await printHtmlToEscPosApp(combinedHtml, {
    feedLines: 2,
    autoCut: fullCut ? "full" : "partial",
    openDrawer,
  });
  if (!ok) throw new Error("No se pudo imprimir por ESC/POS Print Service");
}

export function generateClientTicketHTML(
  items: CartItem[],
  total: number,
  orderNumber: number | null,
  customerName: string,
  dateStr: string,
  paymentMethodLabel: string = "Efectivo"
): string {
  const logoUrl =
    typeof window !== "undefined"
      ? `${window.location.origin.replace(/\/$/, "")}/juliana-logo.png`
      : "/juliana-logo.png";

  const renderedItems = items
    .map((item) => {
      const line = `${item.quantity}x ${getDisplayProductName(item.product.name)}${item.productSize ? ` (${item.productSize.name})` : ""}`;
      const details = item.customLabel ? `<div class="item-detail">• ${escapeHtml(item.customLabel)}</div>` : `<div class="item-detail">• Sin extras</div>`;
      return `<div class="item-row"><span class="item-name">${escapeHtml(line)}</span><span class="item-price">$${item.subtotal.toFixed(0)}</span></div>${details}`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}body{margin:0;padding:8px;background:#fff;color:#111;font-family:'Segoe UI',Tahoma,sans-serif}
  .ticket{border:2px solid #111;border-radius:14px;padding:10px}
  .logo{display:block;margin:6px auto 2px;max-width:170px;height:auto}
  .subtitle{text-align:center;font-weight:700;letter-spacing:.16em;font-size:12px;margin-top:8px}
  .address{text-align:center;font-size:10px;line-height:1.35;color:#333;margin-top:6px}
  .section{margin-top:10px;font-weight:700;letter-spacing:.12em;font-size:11px}
  .meta{margin-top:6px;border:1px solid #bbb;border-radius:8px;padding:8px;font-size:11px}
  .meta-row{display:flex;justify-content:space-between;margin:2px 0}
  .consume{margin-top:8px;border:1px dashed #bbb;border-radius:8px;padding:8px}
  .item-row{display:flex;justify-content:space-between;font-weight:700;font-size:12px;margin-top:2px}
  .item-detail{font-size:11px;color:#555;margin:3px 0 7px 4px}
  .total{margin-top:10px;border:2px solid #111;border-radius:8px;padding:8px;display:flex;justify-content:space-between;align-items:center;font-size:34px;font-weight:800}
  .total-label{font-size:16px}
  .foot{margin-top:10px;border-top:2px solid #111;padding-top:6px;text-align:center;font-weight:700;letter-spacing:.12em;font-size:11px;color:#444}
  </style></head><body><div class="ticket">
  <img class="logo" src="${logoUrl}" alt="Juliana" onerror="this.style.display='none'">
  <div class="subtitle">BARRA COTIDIANA</div>
  <div class="address">AV. MIGUEL HIDALGO #276, COL CENTRO, ACAMBARO GTO.<br>Tel. 417 206 9111</div>
  <div class="section">DETALLE DEL PEDIDO</div>
  <div class="meta">
    <div class="meta-row"><span>Pedido</span><strong>#${orderNumber || "---"}</strong></div>
    <div class="meta-row"><span>Cliente</span><strong>${escapeHtml(customerName || "Barra")}</strong></div>
    <div class="meta-row"><span>Fecha</span><span>${escapeHtml(dateStr)}</span></div>
    <div class="meta-row"><span>Pago</span><strong>${escapeHtml(paymentMethodLabel)}</strong></div>
  </div>
  <div class="section">CONSUMO</div>
  <div class="consume">${renderedItems}</div>
  <div class="total"><span class="total-label">TOTAL</span><span>$${total.toFixed(0)}</span></div>
  <div class="foot">GRACIAS POR VISITARNOS</div>
  <div class="foot">TE ESPERAMOS PRONTO</div>
  </div></body></html>`;
}

export function generateKitchenOrderHTML(
  items: CartItem[],
  orderNumber: number | null,
  customerName: string,
  dateStr: string
): string {
  const renderedItems = items
    .map((item) => {
      const title = `${item.quantity}x ${getDisplayProductName(item.product.name)}${item.productSize ? ` (${item.productSize.name})` : ""}`;
      const detailLines = [
        ...(item.customizations || []).map((c) => `• ${c.ingredient.name}`),
        ...(item.customLabel ? [`• ${item.customLabel}`] : []),
        ...(item.kitchenNote ? [`• ${item.kitchenNote}`] : []),
      ];
      const details = detailLines.length > 0 ? detailLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("") : "<div>• Sin modificaciones</div>";
      return `<div class="item-box"><div class="item-title">${escapeHtml(title.toUpperCase())}</div><div class="item-details">${details}</div></div>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}body{margin:0;padding:10px;background:#fff;color:#111;font-family:'Courier New',monospace}
  .wrap{width:58mm;margin:0 auto}
  .head{font-size:14px;font-weight:700;text-transform:uppercase}
  .line{border-top:2px solid #111;margin:10px 0}
  .meta{font-size:12px;margin:4px 0}
  .item-box{border:1px solid #111;padding:8px;margin:10px 0}
  .item-title{font-size:18px;font-weight:700;margin-bottom:6px}
  .item-details{font-size:13px;line-height:1.35}
  .footer{text-align:center;font-size:18px;font-weight:700;margin-top:12px}
  </style></head><body><div class="wrap">
  <div class="head">COMANDA #${orderNumber || "---"}</div>
  <div class="meta"><strong>CLIENTE:</strong> ${escapeHtml((customerName || "Barra").toUpperCase())}</div>
  <div class="meta">Hora: ${escapeHtml(dateStr)}</div>
  <div class="line"></div>
  ${renderedItems}
  <div class="line"></div>
  <div class="footer">PREPARAR YA</div>
  </div></body></html>`;
}
