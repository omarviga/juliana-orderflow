// printer-format.ts
// VERSIÓN SOLO ESC/POS PRINT SERVICE

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
// UTILIDADES MÍNIMAS
// ============================================

const normalizeText = (value: string) =>
  value.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const getDisplayProductName = (name: string) =>
  STANDALONE_EXTRA_PRODUCT_NAMES.has(normalizeText(name)) ? "Extra" : name;

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/android/i.test(navigator.userAgent)) return true;
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;
  return Boolean(coarse && navigator.maxTouchPoints > 0);
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
// GENERADORES DE COMANDOS ESC/POS
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

  const commands = [
    ...CMD.RESET,
    ...CMD.CENTER,
    ...CMD.FONT_LARGE,
    ...CMD.BOLD_ON,
    ...encode("JULIANA"),
    ...CMD.BOLD_OFF,
    ...CMD.FONT_NORMAL,
    ...encode("BARRA COTIDIANA"),
    ...encode("AV. MIGUEL HIDALGO #276"),
    ...encode("Tel: 417 206 0111"),
    ...encode(separator),
    ...CMD.LEFT,
    ...CMD.BOLD_ON,
    ...encode(`Pedido: #${orderNumber || "---"}`),
    ...encode(`Cliente: ${customerName || "Barra"}`),
    ...CMD.BOLD_OFF,
    ...encode(dateStr),
    ...encode(`Pago: ${paymentMethodLabel}`),
    ...encode(separator),
  ];

  items.forEach((item) => {
    const itemLine = `${item.quantity}x ${getDisplayProductName(item.product.name)}${item.productSize ? ` (${item.productSize.name})` : ""}`;
    const priceLine = `$${item.subtotal.toFixed(0)}`;
    const spaces = Math.max(1, config.charsPerLine - itemLine.length - priceLine.length);
    commands.push(...encode(itemLine + " ".repeat(spaces) + priceLine));

    if (item.customLabel) commands.push(...encode(`  • ${item.customLabel}`));
    if (item.kitchenNote) commands.push(...encode(`  • Nota: ${item.kitchenNote}`));
  });

  commands.push(...encode(separator));
  commands.push(...CMD.CENTER, ...CMD.FONT_LARGE, ...CMD.BOLD_ON);
  commands.push(...encode(`TOTAL: $${total.toFixed(0)}`));
  commands.push(...CMD.BOLD_OFF, ...CMD.FONT_NORMAL);
  commands.push(...encode(separator));
  commands.push(...encode("¡Gracias por tu visita!"), ...encode("Vuelve pronto"), LF, LF);

  if (options?.openDrawer) {
    commands.push(...(options.drawerNumber === 2 ? CMD.OPEN_DRAWER_2 : CMD.OPEN_DRAWER));
  }

  commands.push(...CMD.FEED(2));
  commands.push(...(options?.fullCut ? CMD.FULL_CUT : CMD.PARTIAL_CUT));

  return commands;
}

export function generateKitchenOrderEscPos(
  items: CartItem[],
  orderNumber: number | null,
  customerName: string,
  dateStr: string,
  options?: { fullCut?: boolean }
): number[] {
  const config = PRINTER_CONFIGS["58mm"];
  const separator = "=".repeat(config.charsPerLine) + "\n";

  const commands = [
    ...CMD.RESET,
    ...CMD.CENTER,
    ...CMD.FONT_LARGE,
    ...CMD.BOLD_ON,
    ...encode(`COMANDA #${orderNumber || "---"}`),
    ...CMD.FONT_NORMAL,
    ...encode(separator),
    ...CMD.LEFT,
    ...CMD.BOLD_ON,
    ...encode(`CLIENTE: ${(customerName || "Barra").toUpperCase()}`),
    ...CMD.BOLD_OFF,
    ...encode(`HORA: ${dateStr}`),
    ...encode(separator),
  ];

  items.forEach((item) => {
    commands.push(
      ...CMD.BOLD_ON,
      ...encode(`${item.quantity}x ${getDisplayProductName(item.product.name)}${item.productSize ? ` (${item.productSize.name})` : ""}`),
      ...CMD.BOLD_OFF
    );

    const details = [
      ...(item.customizations || []).map((c) => c.ingredient.name),
      ...(item.customLabel ? [`📝 ${item.customLabel}`] : []),
      ...(item.kitchenNote ? [`💬 ${item.kitchenNote}`] : []),
    ];

    if (details.length) {
      details.forEach((detail) => commands.push(...encode(`  • ${detail}`)));
    } else {
      commands.push(...encode("  (Sin modificaciones)"));
    }
    commands.push(LF);
  });

  commands.push(LF, LF, ...CMD.FEED(2));
  commands.push(...(options?.fullCut ? CMD.FULL_CUT : CMD.PARTIAL_CUT));

  return commands;
}

// ============================================
// INTERFAZ PARA ESC/POS PRINT SERVICE
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
  void macAddress;
  const { commands, config = {} } = payload;
  const {
    feedLines = 2,
    autoCut = 'full',
    cashDrawer,
  } = config;

  const decoded = commands
    .map((byte) => {
      if (byte === 0x0a) return "\n";
      if (byte < 0x20 || byte > 0x7e) return "";
      return String.fromCharCode(byte);
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const isKitchenTicket = /COMANDA\s*#/i.test(decoded);
  const logoUrl =
    typeof window !== "undefined"
      ? `${window.location.origin.replace(/\/$/, "")}/juliana-logo.png`
      : "/juliana-logo.png";
  const safeDecoded = decoded
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const html = `<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  body{margin:0;padding:10px;font-family:'Segoe UI',Tahoma,sans-serif;background:#fff;color:#111}
  .ticket{border:1px solid #ddd;border-radius:10px;padding:10px}
  .logo-wrap{text-align:center;margin-bottom:8px}
  .logo{max-width:160px;height:auto}
  .title{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-align:center;margin:4px 0 8px}
  pre{margin:0;white-space:pre-wrap;font-family:'Courier New',monospace;font-size:12px;line-height:1.25}
  </style></head><body><div class="ticket">${isKitchenTicket ? "" : `<div class="logo-wrap"><img class="logo" src="${logoUrl}" alt="Juliana"></div><div class="title">Ticket Cliente</div>`}<pre>${safeDecoded}</pre></div></body></html>`;
  const src = `data:text/html,${encodeURIComponent(html)}`;
  const drawer = cashDrawer ? "1" : "0";

  const params = new URLSearchParams();
  params.set("srcTp", "uri");
  params.set("srcObj", "html");
  params.set("numCopies", "1");
  params.set("src", src);
  params.set("feed", String(feedLines));
  params.set("cut", autoCut);
  params.set("drawer", drawer);
  params.set("size", "80mm");

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

    window.location.href = url;
    return true;
  } catch (error) {
    console.error("Error al abrir ESC/POS PrintService:", error);
    return false;
  }
}

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
  dateStr: string,
  options?: { fullCut?: boolean }
): Promise<boolean> {
  const commands = generateKitchenOrderEscPos(items, orderNumber, customerName, dateStr, options);

  return printToEscPosApp(macAddress, commands, {
    feedLines: 2,
    autoCut: options?.fullCut ? 'full' : 'partial',
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
    fullCut?: boolean;
    drawerNumber?: 1 | 2;
  }
): Promise<boolean> {
  const kitchenCommands = generateKitchenOrderEscPos(items, orderNumber, customerName, dateStr, { fullCut: false });
  const clientCommands = generateClientTicketEscPos(
    items, total, orderNumber, customerName, dateStr, paymentMethodLabel,
    { openDrawer: options?.openDrawer, fullCut: options?.fullCut, drawerNumber: options?.drawerNumber }
  );

  const combinedCommands = [...kitchenCommands, ...clientCommands];

  return printToEscPosApp(macAddress, combinedCommands, {
    feedLines: 2,
    autoCut: options?.fullCut ? 'full' : 'partial',
    openDrawer: options?.openDrawer,
    drawerNumber: options?.drawerNumber || 2
  });
}

// ============================================
// COMPATIBILIDAD CON MÓDULOS EXISTENTES (SOLO ESC/POS)
// ============================================

function htmlToEscPosCommands(
  htmlContent: string,
  printerSize: "80mm" | "58mm",
  options?: { openDrawer?: boolean; fullCut?: boolean }
): number[] {
  const text = htmlContent
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");

  const lines = text.split("\n").map((line) => `${line}\n`);
  const commands: number[] = [...CMD.RESET, ...(printerSize === "58mm" ? CMD.FONT_NORMAL : CMD.FONT_NORMAL)];
  lines.forEach((line) => commands.push(...Array.from(textEncoder.encode(line))));
  commands.push(...CMD.FEED(2));
  if (options?.openDrawer) commands.push(...CMD.OPEN_DRAWER_2);
  commands.push(...(options?.fullCut ? CMD.FULL_CUT : CMD.PARTIAL_CUT));
  return commands;
}

export async function printToDevice(
  deviceAddress: string,
  htmlContent: string,
  printerSize: "80mm" | "58mm",
  options?: { openDrawer?: boolean; fullCut?: boolean }
): Promise<void> {
  const commands = htmlToEscPosCommands(htmlContent, printerSize, options);
  const ok = await printToEscPosApp(deviceAddress, commands, {
    feedLines: 2,
    autoCut: options?.fullCut ? "full" : "partial",
    openDrawer: options?.openDrawer,
    drawerNumber: 2,
  });
  if (!ok) throw new Error("No se pudo enviar a ESC/POS Print Service");
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
  const combined: number[] = [];
  jobs.forEach((job) => {
    if (job.escPosCommands && job.escPosCommands.length > 0) {
      combined.push(...job.escPosCommands);
      return;
    }
    if (job.htmlContent) {
      combined.push(...htmlToEscPosCommands(job.htmlContent, job.printerSize, job.options));
    }
  });
  const ok = await printToEscPosApp(deviceAddress, combined, { feedLines: 2, autoCut: "partial" });
  if (!ok) throw new Error("No se pudo enviar lote a ESC/POS Print Service");
}

export function printViaBrowser(): void {
  throw new Error("printViaBrowser deshabilitado: esta instalación usa solo ESC/POS.");
}

export function generateClientTicketHTML(
  items: CartItem[],
  total: number,
  orderNumber: number | null,
  customerName: string,
  dateStr: string,
  paymentMethodLabel: string = "Efectivo"
): string {
  const origin = typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
  const logoUrl = `${origin}/juliana-logo.png`;
  const renderedItems = items
    .map((item) => {
      const name = `${item.quantity}x ${getDisplayProductName(item.product.name)}${item.productSize ? ` (${item.productSize.name})` : ""}`;
      const details = item.customLabel ? `<div class="detail">- ${item.customLabel}</div>` : "";
      return `<div class="row"><span>${name}</span><strong>$${item.subtotal.toFixed(0)}</strong></div>${details}`;
    })
    .join("");

  return `<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}
  body{margin:0;padding:10px;background:#fff;font-family:'Segoe UI',Tahoma,sans-serif;color:#111}
  .ticket{border:1px solid #d9d9d9;border-radius:12px;padding:10px}
  .logo-wrap{text-align:center;margin-bottom:8px}
  .logo{max-width:170px;height:auto}
  .subtitle{text-align:center;font-size:11px;font-weight:700;letter-spacing:.08em;margin-bottom:8px}
  .meta{border:1px dashed #bbb;border-radius:8px;padding:8px;font-size:12px;margin-bottom:8px}
  .meta-line{display:flex;justify-content:space-between;margin:2px 0}
  .items{border-top:1px dashed #bbb;border-bottom:1px dashed #bbb;padding:8px 0}
  .row{display:flex;justify-content:space-between;gap:8px;margin:4px 0;font-size:12px}
  .detail{font-size:11px;color:#555;margin:0 0 4px 8px}
  .total{margin-top:8px;border:2px solid #111;border-radius:8px;padding:8px;display:flex;justify-content:space-between;font-size:18px;font-weight:800}
  .footer{text-align:center;font-size:11px;color:#444;margin-top:8px}
  </style></head><body><div class="ticket">
  <div class="logo-wrap"><img class="logo" src="${logoUrl}" alt="Juliana"></div>
  <div class="subtitle">BARRA COTIDIANA</div>
  <div class="meta">
    <div class="meta-line"><span>Pedido</span><strong>#${orderNumber || "---"}</strong></div>
    <div class="meta-line"><span>Cliente</span><strong>${customerName || "Barra"}</strong></div>
    <div class="meta-line"><span>Fecha</span><span>${dateStr}</span></div>
    <div class="meta-line"><span>Pago</span><strong>${paymentMethodLabel}</strong></div>
  </div>
  <div class="items">${renderedItems}</div>
  <div class="total"><span>TOTAL</span><span>$${total.toFixed(0)}</span></div>
  <div class="footer">Gracias por tu visita</div>
  </div></body></html>`;
}

export function generateKitchenOrderHTML(
  items: CartItem[],
  orderNumber: number | null,
  customerName: string,
  dateStr: string
): string {
  const itemLines = items
    .map((item) => {
      const custom = item.customLabel ? `\n  - ${item.customLabel}` : "";
      const note = item.kitchenNote ? `\n  - Nota: ${item.kitchenNote}` : "";
      return `${item.quantity}x ${getDisplayProductName(item.product.name)}${item.productSize ? ` (${item.productSize.name})` : ""}${custom}${note}`;
    })
    .join("\n");

  return `<html><head><meta charset="UTF-8"></head><body><pre>COMANDA #${orderNumber || "---"}\nCLIENTE: ${(customerName || "Barra").toUpperCase()}\nHORA: ${dateStr}\n================================\n${itemLines}\n</pre></body></html>`;
}
