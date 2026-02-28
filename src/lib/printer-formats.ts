// printer-format.ts
// VERSIÓN SOLO ESC/POS PRINT SERVICE - SIN NADA MÁS

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
  return /android/i.test(navigator.userAgent);
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  OPEN_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xFA], // Cajón 1
  OPEN_DRAWER_2: [ESC, 0x70, 0x01, 0x19, 0xFA], // Cajón 2
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
  commands: number[]; // Comandos ESC/POS
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

/**
 * Construye URL para abrir ESC/POS PrintService
 */
export function buildEscPosAppUrl(macAddress: string, payload: PrintPayload): string {
  const { commands, config = {} } = payload;
  const {
    feedLines = 2,
    autoCut = 'full',
    cashDrawer,
  } = config;

  // Convertir comandos a base64
  const commandsBase64 = btoa(String.fromCharCode(...commands));

  // Construir URL con el esquema oficial
  const url = new URL(`print://escpos.org/escpos/bt/${macAddress}`);

  url.searchParams.append('commands', commandsBase64);
  url.searchParams.append('feed', feedLines.toString());
  url.searchParams.append('cut', autoCut);

  if (cashDrawer) {
    url.searchParams.append('drawer', cashDrawer.drawerNumber.toString());
    url.searchParams.append('drawerOn', (cashDrawer.pulseOn || 50).toString());
    url.searchParams.append('drawerOff', (cashDrawer.pulseOff || 250).toString());
  }

  return url.toString();
}

/**
 * Detecta si estamos en Android (único lugar donde funciona la app)
 */
export function isEscPosAppAvailable(): boolean {
  return isAndroid();
}

/**
 * Función ÚNICA para imprimir - TODO pasa por aquí
 */
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

// ============================================
// FUNCIONES DE ALTO NIVEL (LAS QUE USA EL HOOK)
// ============================================

/**
 * Imprime ticket de cliente (USA SOLO ESC/POS)
 */
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

/**
 * Imprime comanda de cocina (USA SOLO ESC/POS)
 */
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
    openDrawer: false // La comanda no abre cajón
  });
}

/**
 * Imprime ambos (comanda + ticket) en un solo trabajo
 */
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

  // Combinar comandos (kitchen primero, luego cliente)
  const combinedCommands = [...kitchenCommands, ...clientCommands];

  return printToEscPosApp(macAddress, combinedCommands, {
    feedLines: 2,
    autoCut: options?.fullCut ? 'full' : 'partial',
    openDrawer: options?.openDrawer,
    drawerNumber: options?.drawerNumber || 2
  });
}