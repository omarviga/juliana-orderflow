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

function toEscPosSafeText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/•/g, "-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "");
}

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
  void deviceAddress;
  void htmlContent;
  void printerSize;
  void options;
  throw new Error("Modo ESC/POS estricto: printToDevice(html) deshabilitado");
}

const PRINTER_BT_SERVICE_UUID = "00001101-0000-1000-8000-00805f9b34fb";
const PRINTER_BT_FALLBACK_CHAR_UUID = "2a19";

type ActiveBluetoothSession = {
  deviceAddress: string;
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
};

let activeBluetoothSession: ActiveBluetoothSession | null = null;

function clearActiveBluetoothSession(): void {
  activeBluetoothSession = null;
}

async function resolveBluetoothDevice(deviceAddress: string): Promise<BluetoothDevice> {
  const getDevices = navigator.bluetooth.getDevices?.bind(navigator.bluetooth);
  if (getDevices) {
    const pairedDevices = await getDevices();
    const known = pairedDevices.find((device) => device.id === deviceAddress);
    if (known) return known;
  }

  return navigator.bluetooth.requestDevice({
    filters: [{ services: [PRINTER_BT_SERVICE_UUID] }],
    optionalServices: [PRINTER_BT_SERVICE_UUID, "0000180a-0000-1000-8000-00805f9b34fb"],
    acceptAllDevices: false,
  });
}

async function resolveWritableCharacteristic(
  deviceAddress: string
): Promise<BluetoothRemoteGATTCharacteristic> {
  if (
    activeBluetoothSession &&
    activeBluetoothSession.deviceAddress === deviceAddress &&
    activeBluetoothSession.device.gatt?.connected
  ) {
    return activeBluetoothSession.characteristic;
  }

  const device = await resolveBluetoothDevice(deviceAddress);
  const server = device.gatt?.connected ? device.gatt : await device.gatt?.connect();
  if (!server) {
    throw new Error("No se pudo conectar a GATT server");
  }

  const service = await server.getPrimaryService(PRINTER_BT_SERVICE_UUID);
  let characteristic: BluetoothRemoteGATTCharacteristic;
  try {
    characteristic = await service.getCharacteristic(PRINTER_BT_FALLBACK_CHAR_UUID);
  } catch {
    const characteristics = await service.getCharacteristics();
    const writable = characteristics.find((c) => c.properties.write || c.properties.writeWithoutResponse);
    if (!writable) {
      throw new Error("No se encontró característica escribible");
    }
    characteristic = writable;
  }

  const handleDisconnected = () => {
    if (activeBluetoothSession?.device.id === device.id) {
      clearActiveBluetoothSession();
    }
  };

  device.removeEventListener("gattserverdisconnected", handleDisconnected);
  device.addEventListener("gattserverdisconnected", handleDisconnected);

  activeBluetoothSession = {
    deviceAddress,
    device,
    characteristic,
  };

  return characteristic;
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
  if (!navigator.bluetooth) {
    throw new Error("Web Bluetooth API no disponible en este navegador");
  }

  if (jobs.length === 0) {
    return;
  }

  try {
    const characteristic = await resolveWritableCharacteristic(deviceAddress);

    // Convertir todos los HTML a datos imprimibles en un solo trabajo.
    const printData = jobs.flatMap((job) => {
      if (job.escPosCommands) {
        return job.escPosCommands;
      }
      if (job.htmlContent) {
        throw new Error("Modo ESC/POS estricto: htmlContent no permitido");
      }
      return [];
    });

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
  } catch (error) {
    clearActiveBluetoothSession();
    console.error("Error de impresión:", error);
    throw error;
  }
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

  // Inicializacion recomendada por JHP-A: ESC @, ESC t 2, ESC a 0
  if (commandOptions?.includeInit !== false) {
    commands.push(0x1b, 0x40); // ESC @
    commands.push(0x1b, 0x74, 0x02); // ESC t 2 (CP850)
    commands.push(0x1b, 0x61, 0x00); // ESC a 0 (izquierda)
  }

  // Pulso para abrir cajón (ESC p) cuando se solicita explícitamente.
  if (options?.openDrawer) {
    commands.push(0x1b, 0x70, 0x00, 0x32, 0xfa);
  }

  // Configurar tamaño de fuente y área de impresión según tamaño
  if (printerSize === "58mm") {
    // Para 58mm: fuente normal
    commands.push(0x1d, 0x21, 0x00); // GS ! - Font size normal
  } else {
    // Para 80mm: fuente normal
    commands.push(0x1d, 0x21, 0x00);
  }

  // Mantener izquierda por defecto en conversion de HTML a texto plano.
  commands.push(0x1b, 0x61, 0x00); // ESC a 0

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
  const textBytes = encoder.encode(toEscPosSafeText(text));
  commands.push(...Array.from(textBytes));

  // Alineación izquierda (para cierre)
  commands.push(0x1b, 0x61, 0x00); // ESC a - Left alignment

  // Alimentacion previa al corte para evitar cortar sobre el ultimo texto.
  commands.push(0x1b, 0x64, 0x03); // ESC d 3

  // Corte de papel.
  if (options?.fullCut) {
    commands.push(0x1d, 0x56, 0x00); // GS V m=0 - Full cut
  } else {
    commands.push(0x1d, 0x56, 0x01); // GS V m=1 - Partial cut
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
const CODE_PAGE_CP850 = [ESC, 0x74, 2]; // ESC t 2
const FEED_3_LINES = [ESC, 0x64, 3]; // ESC d 3
const PARTIAL_CUT = [GS, 0x56, 1]; // GS V 1
const FULL_CUT = [GS, 0x56, 0]; // GS V 0
const OPEN_DRAWER = [ESC, 0x70, 0, 50, 250]; // ESC p m t1 t2

function encode(text: string): number[] {
  return Array.from(textEncoder.encode(toEscPosSafeText(normalizeText(text)) + "\n"));
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
    ...CODE_PAGE_CP850,
    ...LEFT,
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
  commands.push(...encode("Vuelve pronto"));
  commands.push(...FEED_3_LINES);

  if (options?.openDrawer) commands.push(...OPEN_DRAWER);
  commands.push(...(options?.fullCut ? FULL_CUT : PARTIAL_CUT));

  return commands;
}

export function generateCashCutTicketEscPos(
  sales: CashRegisterSale[],
  generatedAt: string,
  title: string = "CORTE DE CAJA",
  countSummary?: CashCutCountSummary,
  details?: CashCutDetails,
  options?: { openDrawer?: boolean; fullCut?: boolean }
): number[] {
  const config = PRINTER_CONFIGS["80mm"];
  const separator = "-".repeat(config.charsPerLine);
  const cashSales = sales.filter((s) => s.paymentMethod === "efectivo");
  const cardSales = sales.filter((s) => s.paymentMethod === "tarjeta");
  const cashTotal = cashSales.reduce((sum, sale) => sum + sale.total, 0);
  const cardTotal = cardSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
  const depositsTotal = (details?.deposits || []).reduce((sum, d) => sum + d.amount, 0);
  const withdrawalsTotal = (details?.withdrawals || []).reduce((sum, d) => sum + d.amount, 0);
  const deposits = details?.deposits || [];
  const withdrawals = details?.withdrawals || [];
  const products = details?.products || [];
  const chars = config.charsPerLine;

  const toAmount = (value: number) => `$${value.toFixed(0)}`;
  const padRightAmount = (left: string, right: string) => {
    if (left.length + right.length + 1 > chars) {
      return `${left} ${right}`;
    }
    return `${left}${" ".repeat(chars - left.length - right.length)}${right}`;
  };

  const pushSectionTitle = (commands: number[], sectionTitle: string) => {
    commands.push(...encode(separator));
    commands.push(...BOLD_ON, ...encode(sectionTitle), ...BOLD_OFF);
  };

  const commands = [
    ...RESET,
    ...CODE_PAGE_CP850,
    ...LEFT,
    ...CENTER,
    ...FONT_LARGE,
    ...BOLD_ON,
    ...encode(title),
    ...BOLD_OFF,
    ...FONT_NORMAL,
    ...encode("JULIANA"),
    ...encode(generatedAt),
    ...encode(separator),
    ...LEFT,
    ...encode(padRightAmount("VENTAS (TICKETS)", `${sales.length}`)),
    ...encode(padRightAmount("EFECTIVO", toAmount(cashTotal))),
    ...encode(padRightAmount("TARJETA", toAmount(cardTotal))),
  ];

  pushSectionTitle(commands, "DETALLE DE VENTAS");
  if (sales.length === 0) {
    commands.push(...encode("SIN VENTAS REGISTRADAS."));
  } else {
    sales.forEach((sale) => {
      const paymentLabel = sale.paymentMethod === "tarjeta" ? "TARJETA" : "EFECTIVO";
      const saleHeader = padRightAmount(`#${sale.orderNumber}`, `${paymentLabel} ${toAmount(sale.total)}`);
      const hour = new Date(sale.createdAt).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const customer = (sale.customerName || "MOSTRADOR").trim().toLowerCase();
      commands.push(...BOLD_ON, ...encode(saleHeader), ...BOLD_OFF);
      commands.push(...encode(`${hour} - ${customer}`));
      commands.push(...encode("-".repeat(chars)));
    });
  }

  pushSectionTitle(commands, "APERTURA DE CAJA");
  if (details?.opening) {
    const openingHour = new Date(details.opening.createdAt).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    commands.push(
      ...encode(
        padRightAmount(details.opening.note?.trim() || "APERTURA DE CAJA", toAmount(details.opening.amount))
      )
    );
    commands.push(...encode(openingHour));
  } else {
    commands.push(...encode("SIN APERTURA REGISTRADA."));
  }

  pushSectionTitle(commands, "PRODUCTOS VENDIDOS");
  if (products.length === 0) {
    commands.push(...encode("SIN PRODUCTOS VENDIDOS."));
  } else {
    products.forEach((product) => {
      commands.push(
        ...encode(padRightAmount(`${product.name} x ${product.quantity}`, toAmount(product.total)))
      );
    });
  }

  if (deposits.length > 0 || withdrawals.length > 0) {
    pushSectionTitle(commands, "MOVIMIENTOS DE CAJA");
    deposits.forEach((entry) => {
      const hour = new Date(entry.createdAt).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      commands.push(...encode(padRightAmount(`INGRESO ${hour}`, toAmount(entry.amount))));
      if (entry.reason?.trim()) {
        commands.push(...encode(`  ${entry.reason.trim()}`));
      }
    });
    withdrawals.forEach((entry) => {
      const hour = new Date(entry.createdAt).toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      commands.push(...encode(padRightAmount(`RETIRO ${hour}`, toAmount(entry.amount))));
      if (entry.reason?.trim()) {
        commands.push(...encode(`  ${entry.reason.trim()}`));
      }
    });
    commands.push(...encode(padRightAmount("TOTAL INGRESOS", toAmount(depositsTotal))));
    commands.push(...encode(padRightAmount("TOTAL RETIROS", toAmount(withdrawalsTotal))));
  }

  if (countSummary) {
    pushSectionTitle(commands, "CONTEO EFECTIVO");
    countSummary.entries
      .filter((entry) => entry.quantity > 0)
      .forEach((entry) => {
        commands.push(
          ...encode(
            padRightAmount(`${entry.label} x ${entry.quantity}`, toAmount(entry.value * entry.quantity))
          )
        );
      });
    commands.push(...encode(padRightAmount("EFECTIVO ESPERADO", toAmount(countSummary.expectedCash))));
    commands.push(...encode(padRightAmount("EFECTIVO CONTADO", toAmount(countSummary.countedCash))));
    commands.push(...encode(padRightAmount("DIFERENCIA", toAmount(countSummary.difference))));
  }

  commands.push(...encode(separator));
  commands.push(...LEFT, ...FONT_LARGE, ...BOLD_ON);
  commands.push(...encode(padRightAmount("TOTAL", toAmount(totalSales))));
  commands.push(...BOLD_OFF, ...FONT_NORMAL);
  commands.push(...FEED_3_LINES);

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
    ...CODE_PAGE_CP850,
    ...LEFT,
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
      ...(item.customLabel ? [`NOTA: ${item.customLabel}`] : []),
      ...(item.kitchenNote ? [`OBS: ${item.kitchenNote}`] : []),
    ];

    if (details.length > 0) {
      details.forEach((detail) => commands.push(...encode(`  • ${detail}`)));
    } else {
      commands.push(...encode("  (Sin modificaciones)"));
    }
    commands.push(LF);
  });

  commands.push(...FEED_3_LINES);
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
  void htmlContent;
  void printerUrl;
  void printerSize;
  throw new Error("Modo ESC/POS estricto: printToCups/web deshabilitado");
}

/**
 * Imprime usando la API de impresión del navegador (fallback).
 * Esto crea un iframe oculto, escribe el HTML en él y abre el diálogo de impresión
 * para ese iframe, evitando abrir una nueva pestaña.
 */
export function printViaBrowser(htmlContent: string, title: string = "Impresión"): void {
  void htmlContent;
  void title;
  throw new Error("Modo ESC/POS estricto: impresión web/html deshabilitada");
}
