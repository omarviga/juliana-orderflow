// printer-format.ts - VERSIÓN CORREGIDA CON ENCODING CP850 FUNCIONAL

import type { CartItem } from "@/types/pos";

// ============================================
// CONFIGURACIÓN (SOLO 80mm)
// ============================================

const CHARS = 42; // 80mm: 42 caracteres por línea

const STANDALONE_EXTRA_NAMES = new Set([
  "EXTRA SUELTO",
  "EXTRAS SUELTOS",
  "EXTRA INDEPENDIENTE",
]);

const normalize = (s: string) => s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const getProductName = (name: string) => STANDALONE_EXTRA_NAMES.has(normalize(name)) ? "Extra" : name;

const isAndroid = (): boolean => typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);

// ============================================
// CONSTANTES ESC/POS
// ============================================

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const CMD = {
  RESET: [ESC, 0x40],
  CODE_PAGE: [ESC, 0x74, 0x02], // ESC t 2 = CP850
  LEFT: [ESC, 0x61, 0x00],
  CENTER: [ESC, 0x61, 0x01],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  NORMAL: [GS, 0x21, 0x00],
  LARGE: [GS, 0x21, 0x11],
  FULL_CUT: [GS, 0x56, 0x00],
  DRAWER: [ESC, 0x70, 0x00, 0x19, 0xFA],
  DRAWER2: [ESC, 0x70, 0x01, 0x19, 0xFA],
  FEED: (n: number) => [ESC, 0x64, n],
};

// ============================================
// TABLA DE CONVERSIÓN UTF-8 A CP850
// ============================================

const utf8ToCP850: Record<string, number> = {
  // Minúsculas acentuadas
  'á': 160, 'é': 130, 'í': 161, 'ó': 162, 'ú': 163,
  'ñ': 164, 'ü': 129,
  
  // Mayúsculas acentuadas
  'Á': 181, 'É': 144, 'Í': 214, 'Ó': 224, 'Ú': 233,
  'Ñ': 165, 'Ü': 154,
  
  // Símbolos españoles
  '¿': 168, '¡': 173,
  'ª': 166, 'º': 167,
  '«': 174, '»': 175,
  
  // Símbolos monetarios
  '€': 213, '¢': 155, '£': 156, '¥': 157,
  
  // Símbolos comunes
  '©': 177, '®': 178, '™': 170,
  '°': 248, '·': 250,
  '√': 218, '∞': 234,
  '≈': 241, '≠': 237,
  '≤': 243, '≥': 242,
};

/**
 * Convierte texto UTF-8 a bytes CP850 para impresora ESC/POS
 */
function convertToCP850(text: string): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    
    // ASCII estándar imprimible (32-126) se mantiene igual
    if (code >= 32 && code <= 126) {
      result.push(code);
    }
    // Tabulador, nueva línea, retorno de carro
    else if (code === 9 || code === 10 || code === 13) {
      result.push(code);
    }
    // Caracteres especiales de la tabla CP850
    else if (utf8ToCP850[char] !== undefined) {
      result.push(utf8ToCP850[char]);
    }
    // Para caracteres no soportados, usar espacio
    else {
      // Intentar normalizar (quitar tildes)
      const normalized = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalized.length === 1 && normalized.charCodeAt(0) >= 32 && normalized.charCodeAt(0) <= 126) {
        result.push(normalized.charCodeAt(0));
      } else {
        result.push(32); // Espacio
      }
    }
  }
  
  return result;
}

/**
 * Encode que usa CP850 en lugar de UTF-8
 */
const encode = (text: string): number[] => {
  const cp850Bytes = convertToCP850(text);
  return [...cp850Bytes, LF];
};

const line = (c: string): number[] => encode(c.repeat(CHARS));
const doubleLine = (): number[] => line("=");
const singleLine = (): number[] => line("-");

// ============================================
// GENERADOR DE COMANDA
// ============================================

export function generateKitchenOrderEscPos(
  items: CartItem[],
  orderNumber: number | null,
  customerName: string,
  dateStr: string
): number[] {
  const cmds: number[] = [
    ...CMD.RESET,
    ...CMD.CODE_PAGE,
    ...CMD.LEFT,
    ...CMD.BOLD_ON,
    ...encode(`CLIENTE: ${(customerName || "Barra").toUpperCase()}`),
    ...CMD.BOLD_OFF,
    ...encode(`Hora: ${dateStr}`),
    ...singleLine(),
  ];

  items.forEach(item => {
    cmds.push(
      ...CMD.BOLD_ON,
      ...encode(`${item.quantity}X ${getProductName(item.product.name).toUpperCase()}`),
      ...CMD.BOLD_OFF
    );

    if (item.productSize?.name) {
      cmds.push(...encode(`(${item.productSize.name.toUpperCase()})`));
    }

    if (item.customizations?.length) {
      item.customizations.forEach(c => {
        cmds.push(...encode(`- ${c.ingredient.name.toLowerCase()}`));
      });
    }

    if (item.customLabel) {
      cmds.push(...encode(`*${item.customLabel}`));
    }

    cmds.push(LF);
  });

  cmds.push(...singleLine());
  cmds.push(...CMD.CENTER, ...CMD.BOLD_ON);
  cmds.push(...encode("PREPARAR YA"));
  cmds.push(...CMD.BOLD_OFF);
  cmds.push(...CMD.FEED(3));
  cmds.push(...CMD.FULL_CUT);

  return cmds;
}

// ============================================
// GENERADOR DE TICKET CLIENTE
// ============================================

export function generateClientTicketEscPos(
  items: CartItem[],
  total: number,
  orderNumber: number | null,
  customerName: string,
  dateStr: string,
  paymentMethod: string = "Efectivo",
  options?: { openDrawer?: boolean; drawerNumber?: 1 | 2; skipReset?: boolean }
): number[] {
  const cmds: number[] = [];

  if (!options?.skipReset) {
    cmds.push(...CMD.RESET);
    cmds.push(...CMD.CODE_PAGE);
  }

  cmds.push(
    ...CMD.CENTER,
    ...CMD.LARGE,
    ...CMD.BOLD_ON,
    ...encode("AV. MIGUEL HIDALGO #276, COL CENTRO, ACAMBARO GTO."),
    ...CMD.BOLD_OFF,
    ...CMD.NORMAL,
    ...encode("Tel. 417 206 9111"),
    ...doubleLine(),
    ...CMD.LEFT,
    ...CMD.BOLD_ON,
    ...encode("DETALLE DEL PEDIDO"),
    ...CMD.BOLD_OFF,
    ...singleLine(),
    ...encode(`Pedido: #${orderNumber || "---"}`),
    ...encode(`Cliente: ${customerName || "Barra"}`),
    ...encode(`Fecha: ${dateStr}`),
    ...encode(`Pago: ${paymentMethod}`),
    ...singleLine(),
    ...CMD.BOLD_ON,
    ...encode("CONSUMO"),
    ...CMD.BOLD_OFF,
    ...singleLine(),
  );

  items.forEach(item => {
    cmds.push(
      ...CMD.BOLD_ON,
      ...encode(`- ${item.quantity}x ${getProductName(item.product.name)}`),
      ...CMD.BOLD_OFF
    );

    if (item.productSize?.name) {
      cmds.push(...encode(`  (${item.productSize.name})`));
    }

    if (item.customLabel) {
      cmds.push(...encode(`  - ${item.customLabel}`));
    } else if (item.kitchenNote) {
      cmds.push(...encode(`  - ${item.kitchenNote}`));
    } else {
      cmds.push(...encode(`  - Sin extras`));
    }

    cmds.push(...encode(`  - $${item.subtotal.toFixed(0)}`));
  });

  cmds.push(...doubleLine());
  cmds.push(...CMD.CENTER, ...CMD.LARGE, ...CMD.BOLD_ON);
  cmds.push(...encode("TOTAL"));
  cmds.push(...encode(`$${total.toFixed(0)}`));
  cmds.push(...CMD.BOLD_OFF, ...CMD.NORMAL);
  cmds.push(...doubleLine());
  cmds.push(...CMD.CENTER);
  cmds.push(...encode("GRACIAS POR VISITARNOS"));
  cmds.push(LF, LF);

  if (options?.openDrawer) {
    cmds.push(...(options.drawerNumber === 2 ? CMD.DRAWER2 : CMD.DRAWER));
  }

  cmds.push(...CMD.FEED(3));
  cmds.push(...CMD.FULL_CUT);

  return cmds;
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
  paymentMethod: string = "Efectivo",
  options?: { openDrawer?: boolean; drawerNumber?: 1 | 2 }
): number[] {
  const kitchen = generateKitchenOrderEscPos(items, orderNumber, customerName, dateStr);
  const client = generateClientTicketEscPos(items, total, orderNumber, customerName, dateStr, paymentMethod, {
    openDrawer: options?.openDrawer,
    drawerNumber: options?.drawerNumber,
    skipReset: true
  });

  return [...kitchen, ...client];
}

// ============================================
// FUNCIONES PARA ESC/POS PRINT SERVICE
// ============================================

export interface PrintPayload {
  commands: number[];
  config?: {
    feedLines?: number;
    autoCut?: 'full' | 'partial';
    cashDrawer?: { drawerNumber: 1 | 2; pulseOn?: number; pulseOff?: number };
  };
}

export function buildEscPosAppUrl(macAddress: string, payload: PrintPayload): string {
  const { commands, config = {} } = payload;
  const { feedLines = 2, autoCut = 'full', cashDrawer } = config;

  const binary = String.fromCharCode(...new Uint8Array(commands));
  const params = new URLSearchParams({
    commands: btoa(binary),
    feed: String(feedLines),
    cut: autoCut,
  });

  if (cashDrawer) {
    params.set("drawer", cashDrawer.drawerNumber.toString());
    params.set("pulseOn", String(cashDrawer.pulseOn || 50));
    params.set("pulseOff", String(cashDrawer.pulseOff || 250));
  }

  return `print://escpos.org/escpos/bt/${macAddress}?${params.toString()}`;
}

export const isEscPosAppAvailable = isAndroid;

export async function printToEscPosApp(
  macAddress: string,
  commands: number[],
  options?: { feedLines?: number; autoCut?: 'full' | 'partial'; openDrawer?: boolean; drawerNumber?: 1 | 2 }
): Promise<boolean> {
  if (!isAndroid()) return false;
  try {
    window.location.href = buildEscPosAppUrl(macAddress, {
      commands,
      config: {
        feedLines: options?.feedLines || 2,
        autoCut: options?.autoCut || 'full',
        cashDrawer: options?.openDrawer ? { drawerNumber: options.drawerNumber || 2, pulseOn: 50, pulseOff: 250 } : undefined
      }
    });
    return true;
  } catch {
    return false;
  }
}

// ============================================
// FUNCIONES DE ALTO NIVEL
// ============================================

export const printClientTicket = (mac: string, i: CartItem[], t: number, o: number | null, c: string, d: string, p: string = "Efectivo", opt?: any) =>
  printToEscPosApp(mac, generateClientTicketEscPos(i, t, o, c, d, p, opt), { feedLines: 2, autoCut: 'full', openDrawer: opt?.openDrawer, drawerNumber: opt?.drawerNumber || 2 });

export const printKitchenOrder = (mac: string, i: CartItem[], o: number | null, c: string, d: string) =>
  printToEscPosApp(mac, generateKitchenOrderEscPos(i, o, c, d), { feedLines: 2, autoCut: 'full', openDrawer: false });

export const printBoth = (mac: string, i: CartItem[], t: number, o: number | null, c: string, d: string, p: string = "Efectivo", opt?: any) =>
  printToEscPosApp(mac, generateBothEscPos(i, t, o, c, d, p, opt), { feedLines: 2, autoCut: 'full', openDrawer: opt?.openDrawer, drawerNumber: opt?.drawerNumber || 2 });