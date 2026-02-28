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
// FUNCIONES DE COMPATIBILIDAD (MÍNIMAS)
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