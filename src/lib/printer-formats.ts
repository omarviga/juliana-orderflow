import type { CartItem } from "@/types/pos";
import type { CashRegisterSale } from "@/lib/cash-register";
const PRINT_GATEWAY_URL = import.meta.env.VITE_PRINT_GATEWAY_URL?.trim();
const PRINT_GATEWAY_TOKEN = import.meta.env.VITE_PRINT_GATEWAY_TOKEN?.trim();

export interface CashCountEntry {
  label: string;
  value: number;
  quantity: number;
}

export interface CashCutCountSummary {
  expectedCash: number;
  countedCash: number;
  difference: number;
  entries: CashCountEntry[];
}

export interface CashCutProductSummary {
  name: string;
  quantity: number;
  total: number;
}

export interface CashCutWithdrawalSummary {
  amount: number;
  reason: string;
  createdAt: string;
}

export interface CashCutCardTransactionSummary {
  orderNumber: number;
  customerName: string;
  total: number;
  createdAt: string;
}

export interface CashCutDetails {
  opening?: {
    amount: number;
    note: string;
    createdAt: string;
  } | null;
  products?: CashCutProductSummary[];
  deposits?: CashCutWithdrawalSummary[];
  withdrawals?: CashCutWithdrawalSummary[];
  cardTransactions?: CashCutCardTransactionSummary[];
}

interface PrinterConfig {
  width: number; // mm
  charsPerLine: number;
  fontSize: "small" | "medium" | "large";
}

const PRINTER_CONFIGS: Record<string, PrinterConfig> = {
  "80mm": { width: 80, charsPerLine: 42, fontSize: "medium" },
  "58mm": { width: 58, charsPerLine: 32, fontSize: "small" },
};

const STANDALONE_EXTRA_PRODUCT_NAMES = new Set([
  "EXTRA SUELTO",
  "EXTRAS SUELTOS",
  "EXTRA INDEPENDIENTE",
]);

const normalizeText = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

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

/**
 * Genera HTML para ticket de cliente (80mm)
 */
type ClientTicketStyle = "clasico" | "minimal";
const CLIENT_TICKET_STYLE: ClientTicketStyle = "clasico";

export function generateClientTicketHTML(
  items: CartItem[],
  total: number,
  orderNumber: number | null,
  customerName: string,
  dateStr: string,
  paymentMethodLabel: string = "Efectivo"
): string {
  const config = PRINTER_CONFIGS["80mm"];
  const safeCustomerName = escapeHtml(customerName || "---");
  const safeDate = escapeHtml(dateStr);
  const renderedItems = items
    .map((item) => {
      const itemLine = `${item.quantity}x ${getDisplayProductName(item.product.name)}${item.productSize ? ` (${item.productSize.name})` : ""}`;
      const safeItemLine = escapeHtml(itemLine);
      const priceLine = `$${item.subtotal.toFixed(0)}`;
      const detail = item.customLabel
        ? `<div class="item-detail">${escapeHtml(item.customLabel)}</div>`
        : "";

      return `<div class="item-row"><span class="item-name">${safeItemLine}</span><span class="item-price">${priceLine}</span></div>${detail}`;
    })
    .join("");

  if (CLIENT_TICKET_STYLE === "minimal") {
    return `
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; width: ${config.width}mm; font-family: 'Courier New', monospace; color: #000; }
            .receipt { padding: 3mm; font-size: 10px; }
            .center { text-align: center; }
            .title { font-size: 16px; font-weight: 700; letter-spacing: 1px; }
            .subtitle { font-size: 10px; font-weight: 700; margin-top: 1mm; }
            .meta { font-size: 9px; margin-top: 1mm; line-height: 1.35; }
            .sep { border-top: 1px dashed #000; margin: 2mm 0; }
            .row { display: flex; justify-content: space-between; gap: 2mm; margin: 1mm 0; }
            .muted { color: #333; }
            .item-row { display: flex; justify-content: space-between; gap: 2mm; margin: 1mm 0; }
            .item-name { font-weight: 700; max-width: 52mm; }
            .item-price { font-weight: 700; white-space: nowrap; }
            .item-detail { margin-left: 2mm; font-size: 9px; }
            .total { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 1.5mm 0; margin-top: 2mm; font-size: 13px; font-weight: 800; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="receipt print-ticket-cliente">
            <div class="center title">JULIANA</div>
            <div class="center subtitle">BARRA COTIDIANA</div>
            <div class="center meta">AV. MIGUEL HIDALGO #276, COL CENTRO, ACAMBARO GTO.<br/>Tel. 417 206 9111</div>
            <div class="sep"></div>
            <div class="row"><span class="muted">Pedido</span><strong>#${orderNumber || "---"}</strong></div>
            <div class="row"><span class="muted">Cliente</span><strong>${safeCustomerName}</strong></div>
            <div class="row"><span class="muted">Fecha</span><span>${safeDate}</span></div>
            <div class="row"><span class="muted">Pago</span><strong>${escapeHtml(paymentMethodLabel)}</strong></div>
            <div class="sep"></div>
            ${renderedItems}
            <div class="total"><span>TOTAL</span><span>$${total.toFixed(0)}</span></div>
            <div class="center meta" style="margin-top:2mm;">Gracias por visitarnos</div>
          </div>
        </body>
      </html>
    `;
  }

  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; background: #fff; font-family: 'Trebuchet MS', 'Segoe UI', Arial, sans-serif; width: ${config.width}mm; color: #111; }
          .receipt { width: 100%; padding: 3mm; }
          .brand-top { border: 2px solid #000; border-radius: 8px; padding: 2.5mm 2mm; text-align: center; margin-bottom: 2mm; }
          .brand-logo { display: flex; justify-content: center; margin-bottom: 1.5mm; }
          .brand-logo img { width: 42mm; max-width: 100%; height: auto; }
          .brand-script { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; line-height: 1; color: #000; }
          .brand-subtitle { margin-top: 1mm; font-size: 10px; font-weight: 700; letter-spacing: 1.4px; color: #000; }
          .brand-meta { margin-top: 1.5mm; font-size: 9px; line-height: 1.35; color: #3a3a3a; }
          .section-title { margin: 1.2mm 0 1mm; font-size: 9px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase; color: #000; }
          .order-box { border: 1px solid #d9d9d9; border-radius: 6px; padding: 1.8mm; font-size: 10px; }
          .order-line { display: flex; justify-content: space-between; gap: 2mm; margin: 0.7mm 0; }
          .muted { color: #666; }
          .items-box { border: 1px dashed #b8b8b8; border-radius: 6px; padding: 1.6mm; }
          .item-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 2mm; font-size: 10px; margin: 1mm 0; }
          .item-name { font-weight: 700; color: #111; max-width: 50mm; line-height: 1.25; }
          .item-price { font-weight: 700; white-space: nowrap; }
          .item-detail { margin: 0 0 1mm 2mm; font-size: 9px; color: #5f5f5f; line-height: 1.25; }
          .item-detail::before { content: "• "; color: #000; }
          .total-row { margin-top: 2mm; border: 2px solid #000; border-radius: 7px; padding: 1.6mm 2mm; display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 800; color: #000; }
          .footer { margin-top: 2mm; text-align: center; font-size: 9.5px; color: #3f3f3f; line-height: 1.35; }
        </style>
      </head>
      <body>
        <div class="receipt print-ticket-cliente">
          <div class="brand-top">
            <div class="brand-logo">
              <img src="/juliana-logo.png" alt="Juliana" />
            </div>
            <div class="brand-script">Juliana</div>
            <div class="brand-subtitle">BARRA COTIDIANA</div>
            <div class="brand-meta">AV. MIGUEL HIDALGO #276, COL CENTRO, ACAMBARO GTO.<br/>Tel. 417 206 9111</div>
          </div>
          <div class="section-title">Detalle del pedido</div>
          <div class="order-box">
            <div class="order-line"><span class="muted">Pedido</span><strong>#${orderNumber || "---"}</strong></div>
            <div class="order-line"><span class="muted">Cliente</span><strong>${safeCustomerName}</strong></div>
            <div class="order-line"><span class="muted">Fecha</span><span>${safeDate}</span></div>
            <div class="order-line"><span class="muted">Pago</span><strong>${escapeHtml(paymentMethodLabel)}</strong></div>
          </div>
          <div class="section-title">Consumo</div>
          <div class="items-box">${renderedItems}</div>
          <div class="total-row"><span>TOTAL</span><span>$${total.toFixed(0)}</span></div>
          <div class="footer">Gracias por visitarnos</div>
          <div class="footer">Te esperamos pronto</div>
        </div>
      </body>
    </html>
  `;
}

export function generateCashCutTicketHTML(
  sales: CashRegisterSale[],
  generatedAt: string,
  title: string = "CORTE DE CAJA",
  countSummary?: CashCutCountSummary,
  details?: CashCutDetails
): string {
  const config = PRINTER_CONFIGS["80mm"];
  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
  const cashSales = sales.filter((s) => s.paymentMethod === "efectivo");
  const cardSales = sales.filter((s) => s.paymentMethod === "tarjeta");
  const cashTotal = cashSales.reduce((sum, sale) => sum + sale.total, 0);
  const cardTotal = cardSales.reduce((sum, sale) => sum + sale.total, 0);

  const saleRows = sales
    .map((sale) => {
      const hour = new Date(sale.createdAt).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const pay = sale.paymentMethod === "tarjeta" ? "TARJETA" : "EFECTIVO";
      return `
        <div class="sale-row">
          <div class="sale-main">
            <span>#${sale.orderNumber}</span>
            <span>${pay}</span>
            <span>$${sale.total.toFixed(0)}</span>
          </div>
          <div class="sale-meta">${hour} · ${escapeHtml(sale.customerName || "Sin nombre")}</div>
        </div>
      `;
    })
    .join("");

  const countedSection = countSummary
    ? `
      <div class="sep"></div>
      <div class="sales-title">CONTEO EFECTIVO</div>
      ${countSummary.entries
        .filter((entry) => entry.quantity > 0)
        .map(
          (entry) => `
            <div class="row">
              <span>${escapeHtml(entry.label)} x ${entry.quantity}</span>
              <strong>$${(entry.value * entry.quantity).toFixed(0)}</strong>
            </div>
          `
        )
        .join("") || "<div class='sale-meta'>Sin denominaciones capturadas.</div>"}
      <div class="row"><span>Efectivo esperado</span><strong>$${countSummary.expectedCash.toFixed(0)}</strong></div>
      <div class="row"><span>Efectivo contado</span><strong>$${countSummary.countedCash.toFixed(0)}</strong></div>
      <div class="row"><span>Diferencia</span><strong>$${countSummary.difference.toFixed(0)}</strong></div>
    `
    : "";

  const productsSection = (details?.products || []).length
    ? `
      <div class="sep"></div>
      <div class="sales-title">PRODUCTOS VENDIDOS</div>
      ${(details?.products || [])
        .map(
          (product) => `
            <div class="row">
              <span>${escapeHtml(product.name)} x ${product.quantity}</span>
              <strong>$${product.total.toFixed(0)}</strong>
            </div>
          `
        )
        .join("")}
    `
    : "";

  const openingSection = details?.opening
    ? `
      <div class="sep"></div>
      <div class="sales-title">APERTURA DE CAJA</div>
      <div class="row">
        <span>${escapeHtml(details.opening.note || "Apertura")}</span>
        <strong>$${details.opening.amount.toFixed(0)}</strong>
      </div>
      <div class="sale-meta">${new Date(details.opening.createdAt).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}</div>
    `
    : "";

  const depositsSection = (details?.deposits || []).length
    ? `
      <div class="sep"></div>
      <div class="sales-title">INGRESOS A CAJA</div>
      ${(details?.deposits || [])
        .map((entry) => {
          const hour = new Date(entry.createdAt).toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          return `
            <div class="sale-row">
              <div class="sale-main">
                <span>${hour}</span>
                <span>$${entry.amount.toFixed(0)}</span>
              </div>
              <div class="sale-meta">${escapeHtml(entry.reason || "Ingreso a caja")}</div>
            </div>
          `;
        })
        .join("")}
    `
    : "";

  const withdrawalsSection = (details?.withdrawals || []).length
    ? `
      <div class="sep"></div>
      <div class="sales-title">RETIROS DE EFECTIVO</div>
      ${(details?.withdrawals || [])
        .map((entry) => {
          const hour = new Date(entry.createdAt).toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          return `
            <div class="sale-row">
              <div class="sale-main">
                <span>${hour}</span>
                <span>$${entry.amount.toFixed(0)}</span>
              </div>
              <div class="sale-meta">${escapeHtml(entry.reason || "Retiro de caja")}</div>
            </div>
          `;
        })
        .join("")}
    `
    : "";

  const cardTransactionsSection = (details?.cardTransactions || []).length
    ? `
      <div class="sep"></div>
      <div class="sales-title">TRANSACCIONES TARJETA</div>
      ${(details?.cardTransactions || [])
        .map((tx) => {
          const hour = new Date(tx.createdAt).toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          return `
            <div class="sale-row">
              <div class="sale-main">
                <span>#${tx.orderNumber}</span>
                <span>$${tx.total.toFixed(0)}</span>
              </div>
              <div class="sale-meta">${hour} · ${escapeHtml(tx.customerName || "Mostrador")}</div>
            </div>
          `;
        })
        .join("")}
    `
    : "";

  return `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; width: ${config.width}mm; font-family: 'Courier New', monospace; color: #000; }
          .ticket { padding: 3mm; font-size: 10px; }
          .center { text-align: center; }
          .title { font-size: 15px; font-weight: 800; letter-spacing: 0.8px; }
          .subtitle { font-size: 10px; margin-top: 1mm; }
          .sep { border-top: 1px dashed #000; margin: 2mm 0; }
          .summary-box { border: 1px solid #000; padding: 1.5mm; }
          .row { display: flex; justify-content: space-between; gap: 2mm; margin: 0.8mm 0; }
          .row strong { font-weight: 800; }
          .sales-title { font-weight: 800; margin-bottom: 1mm; }
          .sale-row { border-bottom: 1px dotted #000; padding: 1mm 0; }
          .sale-main { display: flex; justify-content: space-between; font-weight: 700; }
          .sale-meta { font-size: 9px; margin-top: 0.5mm; color: #333; }
          .total-row { margin-top: 2mm; border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 1.5mm 0; display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; }
        </style>
      </head>
      <body>
        <div class="ticket print-ticket-cliente">
          <div class="center title">${escapeHtml(title)}</div>
          <div class="center subtitle">JULIANA · BARRA COTIDIANA</div>
          <div class="center subtitle">${escapeHtml(generatedAt)}</div>
          <div class="sep"></div>

          <div class="summary-box">
            <div class="row"><span>Ventas (tickets)</span><strong>${sales.length}</strong></div>
            <div class="row"><span>Efectivo</span><strong>$${cashTotal.toFixed(0)}</strong></div>
            <div class="row"><span>Tarjeta</span><strong>$${cardTotal.toFixed(0)}</strong></div>
          </div>

          <div class="sep"></div>
          <div class="sales-title">DETALLE DE VENTAS</div>
          ${saleRows || "<div class='sale-meta'>Sin ventas registradas.</div>"}
          ${openingSection}
          ${productsSection}
          ${depositsSection}
          ${withdrawalsSection}
          ${cardTransactionsSection}
          ${countedSection}

          <div class="total-row"><span>TOTAL</span><span>$${totalSales.toFixed(0)}</span></div>
        </div>
      </body>
    </html>
  `;
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

  let html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            width: ${config.width}mm;
            line-height: 1.3;
          }
          .comanda {
            padding: 3mm;
            text-align: center;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          .header {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 2mm;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .order-info {
            font-size: 12px;
            text-align: left;
            margin-bottom: 2mm;
            padding: 1mm 0;
            border-bottom: 2px solid #000;
            border-top: 2px solid #000;
          }
          .info-line {
            margin: 1mm 0;
            font-weight: bold;
          }
          .items-section {
            margin: 2mm 0;
            text-align: left;
          }
          .item-group {
            margin: 2mm 0;
            padding: 1mm;
            border: 1px solid #000;
            text-align: left;
          }
          .item-line {
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
            margin: 1mm 0;
          }
          .ingredient {
            font-size: 11px;
            font-weight: normal;
            margin-left: 3mm;
            margin-top: 0.5mm;
            text-transform: lowercase;
          }
          .ingredient::before {
            content: "• ";
            font-weight: bold;
          }
          .footer {
            margin-top: 2mm;
            padding-top: 1mm;
            border-top: 2px solid #000;
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
        </style>
      </head>
      <body>
        <div class="comanda">
          <div class="header">🍽️ COMANDA #${orderNumber || "---"}</div>
          
          <div class="order-info">
            <div class="info-line">CLIENTE: ${customerName.toUpperCase()}</div>
            <div class="info-line" style="font-size: 11px; font-weight: normal;">Hora: ${dateStr}</div>
          </div>

          <div class="items-section">
  `;

  // Items con ingredientes
  items.forEach((item, index) => {
    html += `<div class="item-group">`;
    html += `<div class="item-line">${item.quantity}x ${getDisplayProductName(item.product.name)}${item.productSize ? ` (${item.productSize.name})` : ""}</div>`;

    // Mostrar ingredientes/customizaciones
    if (item.customizations && item.customizations.length > 0) {
      html += `<div style="margin-top: 0.5mm; margin-left: 2mm;">`;
      item.customizations.forEach((c) => {
        html += `<div class="ingredient">${c.ingredient.name}</div>`;
      });
      html += `</div>`;
    }

    // Mostrar instrucciones personalizadas
    if (item.customLabel) {
      html += `<div class="ingredient" style="margin-top: 0.5mm; font-style: italic; color: #000;">📝 ${item.customLabel}</div>`;
    }

    if (item.kitchenNote) {
      html += `<div class="ingredient" style="margin-top: 0.5mm; font-style: italic; color: #000; text-transform: none;">Nota cocina: ${escapeHtml(item.kitchenNote)}</div>`;
    }

    // Si no tiene ingredientes
    if (
      (!item.customizations || item.customizations.length === 0) &&
      !item.customLabel &&
      !item.kitchenNote
    ) {
      html += `<div class="ingredient">Sin modificaciones</div>`;
    }

    html += `</div>`;
  });

  html += `
          </div>

          <div class="footer">
            ⏱️ PREPARAR YA
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
  printerSize: "80mm" | "58mm",
  options?: {
    openDrawer?: boolean;
    fullCut?: boolean;
  }
): Promise<void> {
  await printMultipleToDevice(deviceAddress, [
    {
      htmlContent,
      printerSize,
      options,
    },
  ]);
}

export async function printMultipleToDevice(
  deviceAddress: string,
  jobs: Array<{
    htmlContent?: string;
    escPosCommands?: number[];
    printerSize: "80mm" | "58mm";
    options?: {
      openDrawer?: boolean;
      fullCut?: boolean;
    };
  }>
): Promise<void> {
  if (jobs.length === 0) {
    return;
  }

  const webBluetoothSupported = typeof navigator !== "undefined" && !!navigator.bluetooth;
  const isAndroid = printUrlSupportsAndroidEscPosApp();
  const errors: string[] = [];

  if (isAndroid) {
    try {
      await printMultipleViaEscPosAndroidApp(jobs);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido en fallback Android";
      errors.push(`Fallback Android: ${message}`);
      throw new Error(`No se pudo abrir ESC/POS Print Service en Android. ${errors.join(" | ")}`);
    }
  }

  if (webBluetoothSupported) {
    try {
      await printMultipleToDeviceViaWebBluetooth(deviceAddress, jobs);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido en Web Bluetooth";
      errors.push(`Web Bluetooth: ${message}`);
    }
  } else {
    errors.push("Web Bluetooth no disponible");
  }

  throw new Error(`No se pudo imprimir por ESC/POS. ${errors.join(" | ")}`);
}

async function printMultipleToDeviceViaWebBluetooth(
  _deviceAddress: string,
  jobs: Array<{
    htmlContent?: string;
    escPosCommands?: number[];
    printerSize: "80mm" | "58mm";
    options?: {
      openDrawer?: boolean;
      fullCut?: boolean;
    };
  }>
): Promise<void> {
  if (!navigator.bluetooth) {
    throw new Error("Web Bluetooth API no disponible en este navegador");
  }

  try {
    let device;

    try {
      const pairedDevices = await navigator.bluetooth.getAvailability?.();
      if (pairedDevices) {
        device = await navigator.bluetooth.requestDevice({
          filters: [{ services: ["00001101-0000-1000-8000-00805f9b34fb"] }],
          acceptAllDevices: false,
        });
      }
    } catch {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ["00001101-0000-1000-8000-00805f9b34fb"] }],
        optionalServices: ["00001101-0000-1000-8000-00805f9b34fb", "0000180a-0000-1000-8000-00805f9b34fb"],
        acceptAllDevices: false,
      });
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

    const printData = buildEscPosBytesFromJobs(jobs);

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

function buildEscPosBytesFromJobs(
  jobs: Array<{
    htmlContent?: string;
    escPosCommands?: number[];
    printerSize: "80mm" | "58mm";
    options?: {
      openDrawer?: boolean;
      fullCut?: boolean;
    };
  }>
): number[] {
  return jobs.flatMap((job, index) => {
    if (job.escPosCommands) return job.escPosCommands;
    if (!job.htmlContent) return [];
    return htmlToEscPosCommands(job.htmlContent, job.printerSize, job.options, {
      includeInit: index === 0,
    });
  });
}

function bytesToBase64(bytes: number[]): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode(...slice.map((value) => value & 0xff));
  }
  return btoa(binary);
}

function printUrlSupportsAndroidEscPosApp(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /android/i.test(ua);
}

async function printMultipleViaEscPosAndroidApp(
  jobs: Array<{
    htmlContent?: string;
    escPosCommands?: number[];
    printerSize: "80mm" | "58mm";
    options?: {
      openDrawer?: boolean;
      fullCut?: boolean;
    };
  }>
): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Entorno sin window para fallback Android");
  }

  if (!printUrlSupportsAndroidEscPosApp()) {
    throw new Error("Fallback print://escpos no disponible fuera de Android");
  }

  const bytes = buildEscPosBytesFromJobs(jobs);
  if (bytes.length === 0) {
    throw new Error("No hay contenido para imprimir en fallback Android");
  }

  const textPayload = jobs
    .map((job) => (job.htmlContent ? htmlToPlainText(job.htmlContent) : ""))
    .filter((line) => line.trim().length > 0)
    .join("\n\n");

  const feedLines = 3;
  const openDrawer = jobs.some((job) => job.options?.openDrawer);
  const fullCut = jobs.some((job) => job.options?.fullCut);
  const printerSize = jobs[0]?.printerSize || "80mm";
  const params = new URLSearchParams();
  params.set("raw", bytesToBase64(bytes));
  params.set("encoding", "base64");
  params.set("text", textPayload);
  params.set("feed", String(feedLines));
  params.set("cut", fullCut ? "full" : "partial");
  params.set("drawer", openDrawer ? "1" : "0");
  params.set("size", printerSize);

  // Formato solicitado por ESC POS Print Service: print://escpos.org/escpos/bt/
  const schemeUrl = `print://escpos.org/escpos/bt/print?${params.toString()}`;
  window.location.href = schemeUrl;
}

/**
 * Convierte HTML a comandos ESC/POS para impresoras térmicas
 */
function htmlToEscPosCommands(
  html: string,
  printerSize: "80mm" | "58mm",
  options?: {
    openDrawer?: boolean;
    fullCut?: boolean;
  },
  commandOptions?: {
    includeInit?: boolean;
  }
): number[] {
  const commands: number[] = [];

  // Inicializar impresora
  if (commandOptions?.includeInit !== false) {
    commands.push(0x1b, 0x40); // ESC @ - Reset
  }

  // Pulso para abrir cajón (ESC p) cuando se solicita explícitamente.
  if (options?.openDrawer) {
    commands.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
  }

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
  const text = html
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

  // Corte de papel.
  if (options?.fullCut) {
    commands.push(0x1d, 0x56, 0x00); // GS V m=0 - Full cut
  } else {
    commands.push(0x1d, 0x56, 0x41, 0x00); // GS V - Partial cut
    commands.push(0x1b, 0x69); // ESC i - Partial cut with feed
  }

  return commands;
}

const textEncoder = new TextEncoder();

const ESC = 0x1b;
const GS = 0x1d;

const LF = 0x0a;
const CENTER = [ESC, 0x61, 1];
const LEFT = [ESC, 0x61, 0];
const BOLD_ON = [ESC, 0x45, 1];
const BOLD_OFF = [ESC, 0x45, 0];
const FONT_NORMAL = [GS, 0x21, 0];
const FONT_LARGE = [GS, 0x21, 17]; // 2x height, 2x width
const RESET = [ESC, 0x40];
const PARTIAL_CUT = [GS, 0x56, 66, 0];
const FULL_CUT = [GS, 0x56, 65, 0];
const OPEN_DRAWER = [ESC, 0x70, 0, 25, 250];

function encode(text: string): number[] {
  return Array.from(textEncoder.encode(normalizeText(text) + "\n"));
}

export function generateClientTicketEscPos(
  items: CartItem[],
  total: number,
  orderNumber: number | null,
  customerName: string,
  dateStr: string,
  paymentMethodLabel: string = "Efectivo",
  options?: { openDrawer?: boolean; fullCut?: boolean }
): number[] {
  const config = PRINTER_CONFIGS["80mm"];
  const separator = "-".repeat(config.charsPerLine) + "\n";

  const commands = [
    ...RESET,
    ...CENTER,
    ...FONT_LARGE,
    ...BOLD_ON,
    ...encode("JULIANA"),
    ...BOLD_OFF,
    ...FONT_NORMAL,
    ...encode("BARRA COTIDIANA"),
    ...encode("AV. MIGUEL HIDALGO #276"),
    ...encode("Tel: 417 206 0111"),
    ...encode(separator),
    ...LEFT,
    ...BOLD_ON,
    ...encode(`Pedido: #${orderNumber || "---"}`),
    ...encode(`Nombre: ${customerName}`),
    ...BOLD_OFF,
    ...encode(dateStr),
    ...encode(`Pago: ${paymentMethodLabel}`),
    ...encode(separator),
  ];

  items.forEach((item) => {
    const itemLine = `${item.quantity}x ${getDisplayProductName(item.product.name)}${item.productSize ? ` (${item.productSize.name})` : ""}`;
    const priceLine = `$${item.subtotal.toFixed(0)}`;
    const spaces = Math.max(1, config.charsPerLine - itemLine.length - priceLine.length);
    const line = itemLine + " ".repeat(spaces) + priceLine;
    commands.push(...encode(line));

    if (item.customLabel) {
      commands.push(...encode(`  • ${item.customLabel}`));
    }
    if (item.kitchenNote) {
      commands.push(...encode(`  • Nota: ${item.kitchenNote}`));
    }
  });

  commands.push(...encode(separator));
  commands.push(...CENTER, ...FONT_LARGE, ...BOLD_ON);
  commands.push(...encode(`TOTAL: $${total.toFixed(0)}`));
  commands.push(...BOLD_OFF, ...FONT_NORMAL);
  commands.push(...encode(separator));
  commands.push(...encode("¡Gracias por tu visita!"));
  commands.push(...encode("Vuelve pronto"), LF, LF);

  if (options?.openDrawer) commands.push(...OPEN_DRAWER);
  commands.push(...(options?.fullCut ? FULL_CUT : PARTIAL_CUT));

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
    ...RESET,
    ...CENTER,
    ...FONT_LARGE,
    ...BOLD_ON,
    ...encode(`COMANDA #${orderNumber || "---"}`),
    ...FONT_NORMAL,
    ...encode(separator),
    ...LEFT,
    ...BOLD_ON,
    ...encode(`CLIENTE: ${customerName.toUpperCase()}`),
    ...BOLD_OFF,
    ...encode(`HORA: ${dateStr}`),
    ...encode(separator),
  ];

  items.forEach((item) => {
    commands.push(
      ...BOLD_ON,
      ...encode(`${item.quantity}x ${getDisplayProductName(item.product.name)}${item.productSize ? ` (${item.productSize.name})` : ""}`),
      ...BOLD_OFF
    );

    const details = [
      ...(item.customizations || []).map((c) => c.ingredient.name),
      ...(item.customLabel ? [`📝 ${item.customLabel}`] : []),
      ...(item.kitchenNote ? [`💬 ${item.kitchenNote}`] : []),
    ];

    if (details.length > 0) {
      details.forEach((detail) => commands.push(...encode(`  • ${detail}`)));
    } else {
      commands.push(...encode("  (Sin modificaciones)"));
    }
    commands.push(LF);
  });

  commands.push(LF, LF);
  commands.push(...(options?.fullCut ? FULL_CUT : PARTIAL_CUT));

  return commands;
}


function htmlToPlainText(htmlContent: string): string {
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const bodyText = doc.body?.textContent ?? "";
    return bodyText
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 0)
      .join("\n");
  }

  return htmlContent
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function printToCups(
  htmlContent: string,
  printerUrl: string,
  printerSize: "80mm" | "58mm" = "80mm"
): Promise<void> {
  const payload = htmlToPlainText(htmlContent);
  const lines = payload.split("\n").filter((line) => line.trim().length > 0);
  const errors: string[] = [];

  const tryRequest = async (url: string, init: RequestInit, label: string) => {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`${label} respondió ${response.status}`);
    }
  };

  const attempts: Array<() => Promise<void>> = [];

  const uniqueFastUrls = new Set<string>();
  const ensureFastUrl = (value: string) => {
    const trimmed = value.trim().replace(/\/$/, "");
    if (!trimmed) return;
    if (/\/api\/print-ticket(?:\?|$)/.test(trimmed)) {
      uniqueFastUrls.add(trimmed);
      return;
    }
    uniqueFastUrls.add(`${trimmed}/api/print-ticket`);
  };

  // 1) Gateway dedicado (el más estable en tablet).
  if (PRINT_GATEWAY_URL) {
    const gatewayUrl = `${PRINT_GATEWAY_URL.replace(/\/$/, "")}/imprimir`;
    attempts.push(async () => {
      await tryRequest(
        gatewayUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(PRINT_GATEWAY_TOKEN ? { Authorization: PRINT_GATEWAY_TOKEN } : {}),
          },
          body: JSON.stringify({
            impresora: printerSize,
            texto: payload,
            abrirCajon: false,
            cortar: true,
          }),
        },
        "Gateway"
      );
    });
  }

  // 2) Endpoint rápido local.
  ensureFastUrl(printerUrl);

  // Compatibilidad: si envían URL de CUPS (puerto 631), intentar automáticamente el bridge local (3001).
  try {
    const parsed = new URL(printerUrl);
    if (parsed.port === "631") {
      const bridge = new URL(parsed.toString());
      bridge.port = "3001";
      bridge.pathname = "/";
      bridge.search = "";
      bridge.hash = "";
      ensureFastUrl(bridge.toString());
    }
  } catch {
    // Ignorar URLs inválidas; los intentos existentes reportarán error claro.
  }

  Array.from(uniqueFastUrls).forEach((fastUrl) => {
    attempts.push(async () => {
      await tryRequest(
        fastUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: printerSize === "58mm" ? "kitchen" : "client",
            lines,
          }),
        },
        "API rápida"
      );
    });
  });

  // 3) URL original (compatibilidad).
  const originalUrl = /\/api\/print-ticket(?:\?|$)/.test(printerUrl)
    ? `${printerUrl}${printerUrl.includes("?") ? "&" : "?"}size=${encodeURIComponent(printerSize)}`
    : `${printerUrl}${printerUrl.includes("?") ? "&" : "?"}size=${encodeURIComponent(printerSize)}`;
  attempts.push(async () => {
    await tryRequest(
      originalUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "X-Printer-Size": printerSize,
        },
        body: payload,
      },
      "Endpoint original"
    );
  });

  for (const attempt of attempts) {
    try {
      await attempt();
      return;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Error desconocido");
    }
  }

  throw new Error(`No se pudo imprimir. Intentos: ${errors.join(" | ")}`);
}

/**
 * Imprime usando la API de impresión del navegador (fallback).
 * Esto crea un iframe oculto, escribe el HTML en él y abre el diálogo de impresión
 * para ese iframe, evitando abrir una nueva pestaña.
 */
export function printViaBrowser(htmlContent: string, title: string = "Impresión"): void {
  // Desactivar cualquier intento de abrir una nueva pestaña durante la impresión.
  const originalOpen = window.open;
  window.open = () => null;

  // Crear un iframe para la impresión (misma ventana)
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", title);

  // Ocultarlo de la vista
  iframe.style.position = "absolute";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  iframe.style.top = "-1000px";
  iframe.style.left = "-1000px";

  document.body.appendChild(iframe);

  const iframeWindow = iframe.contentWindow;
  if (!iframeWindow) {
    window.open = originalOpen;
    document.body.removeChild(iframe);
    throw new Error("No se pudo obtener la ventana del iframe de impresión.");
  }

  // Escribir el contenido HTML en el iframe
  iframeWindow.document.open();
  iframeWindow.document.write(htmlContent);
  iframeWindow.document.close();

  // Esperar a que el contenido cargue completamente antes de imprimir
  iframe.onload = () => {
    iframeWindow.focus(); // Necesario para algunos navegadores
    try {
      iframeWindow.print();
    } catch (e) {
      console.error("Error al intentar imprimir:", e);
      throw new Error("Fallo al invocar la impresión del navegador.");
    } finally {
      // Restaurar window.open y limpiar el iframe
      window.open = originalOpen;
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 500);
    }
  };

  // Fallback por si onload no se dispara en algunos casos (ej. about:blank)
  setTimeout(() => {
    if (iframe.contentWindow?.document.readyState === "complete") {
      iframe.onload?.(new Event("load"));
    }
  }, 100);
}
