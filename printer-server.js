/**
 * Servidor Express simple para servir endpoints de Bluetooth Print
 * 
 * Uso:
 * 1. Instala dependencias: npm install express cors
 * 2. Ejecuta: node printer-server.js
 * 3. Abre: http://localhost:3001/
 * 
 * Desde Juliana POS, usa: my.bluetoothprint.scheme://http://localhost:3001/api/print/ticket
 */

import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";

const app = express();
const PORT = process.env.PORT || 3001;

const DEFAULT_BUSINESS_NAME = "JULIANA";
const DEFAULT_BUSINESS_SUBTITLE = "BARRA COTIDIANA";
const DEFAULT_BUSINESS_ADDRESS =
  "AV. MIGUEL HIDALGO #276, CENTRO, ACÁMBARO. GTO.";
const DEFAULT_BUSINESS_PHONE = "TEL | WHATSAPP:  417 206 9111";
const PRINTER_80MM_NAME = process.env.PRINTER_80MM_NAME || "GLPrinter_80mm";
const PRINTER_58MM_NAME = process.env.PRINTER_58MM_NAME || PRINTER_80MM_NAME;
const LP_TIMEOUT_MS = Number(process.env.LP_TIMEOUT_MS || 12000);
const ENABLE_WEB_PRINT_SERVICE = false;

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  if (
    !ENABLE_WEB_PRINT_SERVICE &&
    (req.path.startsWith("/api/print") || req.path.startsWith("/api/print-ticket"))
  ) {
    res.status(410).json({
      ok: false,
      error: "Modo ESC/POS estricto: servicio web de impresion deshabilitado",
    });
    return;
  }
  next();
});

function printWithLp({ destination, title, text, timeoutMs = LP_TIMEOUT_MS, raw = false }) {
  return new Promise((resolve, reject) => {
    const args = ["-d", destination, "-t", title, ...(raw ? ["-o", "raw"] : [])];
    const child = spawn("lp", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`Timeout al imprimir (${timeoutMs}ms)`));
    }, timeoutMs);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }
      reject(new Error(stderr.trim() || `lp terminó con código ${code}`));
    });

    child.stdin.end(text);
  });
}

function runCommand(command, args = [], timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`Timeout ejecutando ${command}`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }
      reject(new Error(stderr.trim() || `${command} terminó con código ${code}`));
    });
  });
}

async function checkLpAvailable() {
  try {
    await runCommand("lp", ["-V"]);
    return true;
  } catch {
    return false;
  }
}

async function getPrintersStatus() {
  const lpAvailable = await checkLpAvailable();
  if (!lpAvailable) {
    return {
      lpAvailable: false,
      defaultPrinter: null,
      printers: [],
      error: "No se encontró el comando 'lp'. Instala CUPS (cups-client).",
    };
  }

  let printers = [];
  let defaultPrinter = null;

  try {
    const { stdout } = await runCommand("lpstat", ["-p"]);
    printers = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("printer "))
      .map((line) => {
        const match = line.match(/^printer\s+(\S+)\s+/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
  } catch {
    printers = [];
  }

  try {
    const { stdout } = await runCommand("lpstat", ["-d"]);
    const match = stdout.match(/system default destination:\s*(\S+)/i);
    if (match?.[1]) defaultPrinter = match[1];
  } catch {
    defaultPrinter = null;
  }

  return {
    lpAvailable,
    defaultPrinter,
    printers,
    error: null,
  };
}



const ESC_POS = {
  INIT: Buffer.from([0x1b, 0x40]),
  CODE_PAGE_CP850: Buffer.from([0x1b, 0x74, 0x02]),
  ALIGN_LEFT: Buffer.from([0x1b, 0x61, 0x00]),
  OPEN_DRAWER: Buffer.from([0x1b, 0x70, 0x00, 0x32, 0xfa]),
  PARTIAL_CUT: Buffer.from([0x1d, 0x56, 0x01]),
  FULL_CUT: Buffer.from([0x1d, 0x56, 0x00]),
  FEED_3_LINES: Buffer.from([0x1b, 0x64, 0x03]),
};

function buildEscPosDocument(lines, options = {}) {
  const { includeInit = false, openDrawer = false, fullCut = true } = options;
  const text = `${lines
    .map((line) =>
      String(line)
        .replace(/\r\n/g, "\n")
        .replace(/•/g, "-")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x20-\x7E\n]/g, "")
    )
    .join("\n")}\n\n`;
  const chunks = [];

  if (includeInit) {
    chunks.push(ESC_POS.INIT);
    chunks.push(ESC_POS.CODE_PAGE_CP850);
    chunks.push(ESC_POS.ALIGN_LEFT);
  }
  if (openDrawer) chunks.push(ESC_POS.OPEN_DRAWER);
  chunks.push(Buffer.from(text, "utf8"));
  chunks.push(ESC_POS.FEED_3_LINES);
  chunks.push(fullCut ? ESC_POS.FULL_CUT : ESC_POS.PARTIAL_CUT);
  chunks.push(Buffer.from("\n", "utf8"));

  return Buffer.concat(chunks);
}

async function resolvePrinterDestination(type, requestedPrinter) {
  if (requestedPrinter && String(requestedPrinter).trim()) {
    return String(requestedPrinter).trim();
  }

  const envDestination = PRINTER_80MM_NAME;
  const status = await getPrintersStatus();

  if (!status.lpAvailable) {
    throw new Error(status.error || "CUPS/lp no está disponible");
  }

  if (status.printers.includes(envDestination)) {
    return envDestination;
  }

  if (status.defaultPrinter) {
    return status.defaultPrinter;
  }

  if (status.printers.length > 0) {
    return status.printers[0];
  }

  throw new Error("No hay impresoras registradas en CUPS (lpstat -p)");
}

// Tipos para el datos de impresora
/**
 * @typedef {Object} PrinterData
 * @property {0|1|2|3|4} type - 0=text, 1=image, 2=barcode, 3=QR, 4=HTML
 * @property {string} [content]
 * @property {0|1} [bold]
 * @property {0|1|2} [align]
 * @property {0|1|2|3|4} [format]
 * @property {string} [path]
 * @property {string} [value]
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [size]
 */

// Función helper para crear entrada de texto
function createTextEntry(
  content,
  bold = 0,
  align = 1,
  format = 0
) {
  return {
    type: 0,
    content,
    bold,
    align,
    format,
  };
}

function getPrintableTicketLines(payload, options = {}) {
  const { includeBusinessHeader = true } = options;
  const {
    items = [],
    total = 0,
    orderNumber = null,
    customerName = "Cliente",
    businessName = DEFAULT_BUSINESS_NAME,
    businessSubtitle = DEFAULT_BUSINESS_SUBTITLE,
    businessAddress = DEFAULT_BUSINESS_ADDRESS,
    businessPhone = DEFAULT_BUSINESS_PHONE,
  } = payload;

  const dateStr = new Date().toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const lines = [];

  if (includeBusinessHeader) {
    lines.push(
      businessName,
      businessSubtitle,
      businessAddress,
      businessPhone,
      "=".repeat(42)
    );
  }

  lines.push(`Pedido: #${orderNumber || "---"}`, `Nombre: ${customerName}`, dateStr, "=".repeat(42));

  items.forEach((item) => {
    const itemLine = `${item.quantity}x ${item.product?.name || "Items"}${
      item.productSize ? ` (${item.productSize.name})` : ""
    }`;
    lines.push(itemLine);
    lines.push(`   $${(item.subtotal || 0).toFixed(0)}`);

    if (item.customLabel) {
      lines.push(`  • ${item.customLabel}`);
    }
  });

  lines.push("=".repeat(42));
  lines.push(`TOTAL: $${total.toFixed(0)}`);
  lines.push("=".repeat(42));
  lines.push("¡Gracias por tu visita!");
  lines.push("Vuelve pronto");

  return lines;
}

function getPrintableKitchenLines(payload) {
  const { items = [], orderNumber = null, customerName = "Cliente" } = payload;

  const dateStr = new Date().toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const lines = [
    "COMANDA",
    `#${orderNumber || "---"}`,
    "=".repeat(32),
    `Cliente: ${customerName}`,
    `Hora: ${dateStr}`,
    "=".repeat(32),
  ];

  items.forEach((item) => {
    lines.push(`${item.quantity}x ${(item.product?.name || "Item").toUpperCase()}`);

    if (item.productSize) {
      lines.push(`  Tamaño: ${item.productSize.name}`);
    }

    if (item.customLabel) {
      lines.push(`  • ${item.customLabel}`);
    }
  });

  lines.push("=".repeat(32));
  lines.push("PREPARAR AHORA");

  return lines;
}

function escapePdfText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function renderPdfFromLines({ res, lines, title, filePrefix, includeBrandHeader = false }) {
  const safePrefix = filePrefix.replace(/[^a-zA-Z0-9_-]/g, "-");
  const filename = `${safePrefix}-${Date.now()}.pdf`;

  const textLines = includeBrandHeader
    ? [
        "Juliana",
        "BARRA COTIDIANA",
        DEFAULT_BUSINESS_ADDRESS,
        DEFAULT_BUSINESS_PHONE,
        "",
        ...lines,
      ]
    : [title, "", ...lines];
  const startY = 800;
  const lineHeight = 14;

  const contentLines = ["BT", "/F1 11 Tf"];
  textLines.forEach((line, index) => {
    const y = startY - index * lineHeight;
    if (y < 40) return;
    if (includeBrandHeader && index === 0) {
      contentLines.push("/F1 28 Tf");
      contentLines.push(`1 0 0 1 190 ${y} Tm (${escapePdfText(line)}) Tj`);
      contentLines.push("/F1 11 Tf");
      return;
    }

    if (includeBrandHeader && index === 1) {
      contentLines.push("/F1 16 Tf");
      contentLines.push(`1 0 0 1 205 ${y} Tm (${escapePdfText(line)}) Tj`);
      contentLines.push("/F1 11 Tf");
      return;
    }

    contentLines.push(`1 0 0 1 36 ${y} Tm (${escapePdfText(line)}) Tj`);
  });
  contentLines.push("ET");

  const contentStream = contentLines.join("\n");
  const contentLength = Buffer.byteLength(contentStream, "utf8");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj\n",
    `5 0 obj << /Length ${contentLength} >> stream\n${contentStream}\nendstream endobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((obj) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
  res.send(Buffer.from(pdf, "utf8"));
}


// Endpoint de prueba
app.get("/", (req, res) => {
  res.json({
    message: "Servidor de Bluetooth Print funcionando",
    endpoints: {
      test: "GET /api/print/test",
      quickTicket: "POST /api/print-ticket",
      ticket: "POST /api/print/ticket",
      ticketPdf: "POST /api/print/ticket/pdf",
      kitchen: "POST /api/print/kitchen",
      kitchenPdf: "POST /api/print/kitchen/pdf",
      combined: "POST /api/print/combined",
    },
  });
});

app.get("/api/print/status", async (req, res) => {
  const status = await getPrintersStatus();
  res.json({
    ok: status.lpAvailable,
    ...status,
    configured: {
      printer80mm: PRINTER_80MM_NAME,
      printer58mm: PRINTER_58MM_NAME,
    },
  });
});

// Endpoint rápido: imprime directo por CUPS/lp a la 80mm
// Body:
// {
//   "type": "client" | "kitchen",
//   "lines": ["texto 1", "texto 2"], // opcional
//   "payload": { ... } // opcional, para generar líneas automáticamente
// }


app.post("/api/print/combined", async (req, res) => {
  const {
    payload = {},
    clientPayload,
    kitchenPayload,
    printer,
    openDrawer = true,
    fullCut = true,
  } = req.body || {};

  let destination;
  try {
    destination = await resolvePrinterDestination("client", printer);
  } catch (error) {
    res.status(503).json({
      ok: false,
      type: "combined",
      error: error instanceof Error ? error.message : "No se pudo resolver la impresora",
    });
    return;
  }

  const kitchenLines = getPrintableKitchenLines(kitchenPayload || payload);
  const clientLines = getPrintableTicketLines(clientPayload || payload, { includeBusinessHeader: true });

  const kitchenBuffer = buildEscPosDocument(kitchenLines, {
    includeInit: true,
    openDrawer: false,
    fullCut,
  });

  const clientBuffer = buildEscPosDocument(clientLines, {
    includeInit: false,
    openDrawer,
    fullCut,
  });

  try {
    const result = await printWithLp({
      destination,
      title: "Comanda + Ticket",
      text: Buffer.concat([kitchenBuffer, clientBuffer]),
      raw: true,
    });

    res.json({
      ok: true,
      printer: destination,
      type: "combined",
      output: result.stdout || "enviado",
    });
  } catch (error) {
    console.error("Error /api/print/combined:", error);
    res.status(500).json({
      ok: false,
      printer: destination,
      type: "combined",
      error: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

app.post("/api/print-ticket", async (req, res) => {
  const { type = "client", lines, payload = {}, printer } = req.body || {};

  let destination;
  try {
    destination = await resolvePrinterDestination(type, printer);
  } catch (error) {
    res.status(503).json({
      ok: false,
      type,
      error: error instanceof Error ? error.message : "No se pudo resolver la impresora",
    });
    return;
  }

  let printableLines = [];
  if (Array.isArray(lines) && lines.length > 0) {
    printableLines = lines.map((line) => String(line));
  } else if (type === "kitchen") {
    printableLines = getPrintableKitchenLines(payload);
  } else {
    printableLines = getPrintableTicketLines(payload, { includeBusinessHeader: true });
  }

  const text = `${printableLines.join("\n")}\n\n\n`;
  const title = type === "kitchen" ? "Comanda Cocina" : "Ticket Cliente";

  try {
    const result = await printWithLp({
      destination,
      title,
      text,
    });

    res.json({
      ok: true,
      printer: destination,
      type,
      output: result.stdout || "enviado",
    });
  } catch (error) {
    console.error("Error /api/print-ticket:", error);
    res.status(500).json({
      ok: false,
      printer: destination,
      error: error instanceof Error ? error.message : "Error desconocido",
    });
  }
});

// Endpoint de prueba simple
app.get("/api/print/test", (req, res) => {
  const data = [
    createTextEntry(" "),
    createTextEntry("PRUEBA", 1, 1, 3),
    createTextEntry("Servidor funcionando", 0, 1, 0),
    createTextEntry("=".repeat(32), 0, 0, 0),
    createTextEntry("Este es un test de impresión", 0, 1, 0),
    createTextEntry("=".repeat(32), 0, 0, 0),
  ];

  res.json(data);
});

// Endpoint para ticket de cliente
app.post("/api/print/ticket", (req, res) => {
  const {
    items = [],
    total = 0,
    orderNumber = null,
    customerName = "Cliente",
    businessName = DEFAULT_BUSINESS_NAME,
    businessSubtitle = DEFAULT_BUSINESS_SUBTITLE,
    businessAddress = DEFAULT_BUSINESS_ADDRESS,
    businessPhone = DEFAULT_BUSINESS_PHONE,
  } = req.body;

  const data = [];

  // Space
  data.push(createTextEntry(" "));

  // Encabezado de marca (logo textual para impresión)
  data.push({
    type: 4,
    content:
      '<div style="text-align:center;margin-bottom:8px;"><div style="font-size:38px;font-weight:700;line-height:1;">Juliana</div><div style="font-size:22px;font-weight:700;line-height:1.1;">BARRA<br/>COTIDIANA</div></div>',
  });

  // Header
  data.push(createTextEntry(businessName, 1, 1, 3));
  data.push(createTextEntry(businessSubtitle, 0, 1, 0));
  data.push(createTextEntry(businessAddress, 0, 1, 0));
  data.push(createTextEntry(businessPhone, 0, 1, 0));

  // Separador
  data.push(createTextEntry("=".repeat(42), 0, 0, 0));

  // Orden info
  data.push(createTextEntry(`Pedido: #${orderNumber || "---"}`, 1, 0, 0));
  data.push(createTextEntry(`Nombre: ${customerName}`, 1, 0, 0));

  const dateStr = new Date().toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
  data.push(createTextEntry(dateStr, 0, 0, 0));

  // Separador
  data.push(createTextEntry("=".repeat(42), 0, 0, 0));

  // Items
  items.forEach((item) => {
    const itemLine = `${item.quantity}x ${item.product?.name || "Items"}${
      item.productSize ? ` (${item.productSize.name})` : ""
    }`;
    const priceLine = `$${(item.subtotal || 0).toFixed(0)}`;

    data.push({
      type: 4,
      content: `<div style="display: flex; justify-content: space-between;"><span>${itemLine}</span><span style="text-align: right;">${priceLine}</span></div>`,
    });

    if (item.customLabel) {
      data.push(createTextEntry(`  • ${item.customLabel}`, 0, 0, 4));
    }
  });

  // Separador
  data.push(createTextEntry("=".repeat(42), 0, 0, 0));

  // Total
  data.push(createTextEntry(`TOTAL: $${total.toFixed(0)}`, 1, 1, 3));

  // Separador
  data.push(createTextEntry("=".repeat(42), 0, 0, 0));

  // Footer
  data.push(createTextEntry("¡Gracias por tu visita!", 0, 1, 0));
  data.push(createTextEntry("Vuelve pronto", 0, 1, 0));
  data.push(createTextEntry(" ", 0, 1, 0));

  res.json(data);
});

app.post("/api/print/ticket/pdf", (req, res) => {
  const lines = getPrintableTicketLines(req.body, {
    includeBusinessHeader: false,
  });
  renderPdfFromLines({
    res,
    lines,
    title: "Ticket Cliente",
    filePrefix: "ticket-cliente",
    includeBrandHeader: true,
  });
});

// Endpoint para comanda de cocina
app.post("/api/print/kitchen", (req, res) => {
  const {
    items = [],
    orderNumber = null,
    customerName = "Cliente",
  } = req.body;

  const data = [];

  // Space
  data.push(createTextEntry(" "));

  // Header
  data.push(createTextEntry("COMANDA", 1, 1, 3));
  data.push(createTextEntry(`#${orderNumber || "---"}`, 1, 1, 1));

  // Separador
  data.push(createTextEntry("=".repeat(32), 0, 0, 0));

  // Cliente y hora
  data.push(createTextEntry(`👤 ${customerName}`, 1, 0, 0));

  const dateStr = new Date().toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
  data.push(createTextEntry(`🕐 ${dateStr}`, 0, 0, 0));

  // Separador
  data.push(createTextEntry("=".repeat(32), 0, 0, 0));

  // Items
  items.forEach((item) => {
    const itemLine = `${item.quantity}x ${(item.product?.name || "Item").toUpperCase()}`;
    data.push(createTextEntry(itemLine, 1, 0, 0));

    if (item.productSize) {
      data.push(
        createTextEntry(`  Tamaño: ${item.productSize.name}`, 0, 0, 0)
      );
    }

    if (item.customLabel) {
      data.push(createTextEntry(`  • ${item.customLabel}`, 0, 0, 0));
    }
  });

  // Separador
  data.push(createTextEntry("=".repeat(32), 0, 0, 0));

  // Acción
  data.push(createTextEntry("PREPARAR AHORA", 1, 1, 3));

  data.push(createTextEntry(" "));

  res.json(data);
});

app.post("/api/print/kitchen/pdf", (req, res) => {
  const lines = getPrintableKitchenLines(req.body);
  renderPdfFromLines({
    res,
    lines,
    title: "Comanda Cocina",
    filePrefix: "comanda-cocina",
  });
});

app.listen(PORT, () => {
  console.log(`📱 Servidor de Bluetooth Print escuchando en puerto ${PORT}`);
  console.log(`http://localhost:${PORT}`);
  console.log(`\nEndpoints disponibles:`);
  console.log(`- http://localhost:${PORT}/api/print/test`);
  console.log(`- GET http://localhost:${PORT}/api/print/status`);
  console.log(`- POST http://localhost:${PORT}/api/print-ticket`);
  console.log(`- POST http://localhost:${PORT}/api/print/combined`);
  console.log(`- POST http://localhost:${PORT}/api/print/ticket`);
  console.log(`- POST http://localhost:${PORT}/api/print/ticket/pdf`);
  console.log(`- POST http://localhost:${PORT}/api/print/kitchen`);
  console.log(`- POST http://localhost:${PORT}/api/print/kitchen/pdf`);
});
