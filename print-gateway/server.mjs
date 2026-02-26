import cors from "cors";
import express from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number.parseInt(process.env.PORT || "3020", 10);
const API_TOKEN = process.env.PRINT_GATEWAY_TOKEN || "";
const CUPS_QUEUE_TICKET = process.env.CUPS_QUEUE_TICKET || "ticket";
const CUPS_QUEUE_KITCHEN = process.env.CUPS_QUEUE_KITCHEN || "kitchen";
const CUPS_QUEUE_CASH_CUT = process.env.CUPS_QUEUE_CASH_CUT || CUPS_QUEUE_TICKET;
const PRINT_RAW = (process.env.PRINT_RAW || "false").toLowerCase() === "true";
const MAX_RETRIES = Number.parseInt(process.env.MAX_RETRIES || "3", 10);
const RETRY_DELAY_MS = Number.parseInt(process.env.RETRY_DELAY_MS || "1500", 10);
const JOB_FILE_PATH = process.env.JOB_FILE_PATH || path.join(__dirname, "data", "jobs.json");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

let inMemoryJobs = [];
let workerActive = false;

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatMoneyMXN(value) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(safe);
}

function requireToken(req, res, next) {
  if (!API_TOKEN) return next();
  const incoming = req.header("x-print-token") || "";
  if (incoming !== API_TOKEN) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  return next();
}

async function ensureJobStorage() {
  await fs.mkdir(path.dirname(JOB_FILE_PATH), { recursive: true });
  try {
    const raw = await fs.readFile(JOB_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    inMemoryJobs = Array.isArray(parsed) ? parsed : [];
  } catch {
    inMemoryJobs = [];
    await fs.writeFile(JOB_FILE_PATH, JSON.stringify([], null, 2), "utf8");
  }
}

async function persistJobs() {
  await fs.writeFile(JOB_FILE_PATH, JSON.stringify(inMemoryJobs, null, 2), "utf8");
}

function wrapText(line, width = 42) {
  const words = String(line || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const out = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= width) {
      current = next;
      continue;
    }
    if (current) out.push(current);
    current = w.length > width ? w.slice(0, width) : w;
  }
  if (current) out.push(current);
  return out;
}

function leftRight(left, right, width = 42) {
  const l = String(left || "");
  const r = String(right || "");
  const space = Math.max(1, width - l.length - r.length);
  if (space <= 1) return `${l}\n${r}`;
  return `${l}${" ".repeat(space)}${r}`;
}

function renderTicketText(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const orderNumber = payload.orderNumber || "---";
  const customerName = payload.customerName || "Barra";
  const total = Number(payload.total || 0);
  const paymentMethodLabel = payload.paymentMethodLabel || "Efectivo";
  const dateStr = payload.dateStr || new Date().toLocaleString("es-MX");

  const lines = [];
  lines.push("JULIANA - BARRA COTIDIANA");
  lines.push("==========================================");
  lines.push(`Pedido: #${orderNumber}`);
  lines.push(`Cliente: ${customerName}`);
  lines.push(`Fecha: ${dateStr}`);
  lines.push(`Pago: ${paymentMethodLabel}`);
  lines.push("------------------------------------------");

  for (const item of items) {
    const qty = Number(item.quantity || 0);
    const name = item?.product?.name || item?.name || "Item";
    const sizeName = item?.productSize?.name || item?.product_size?.name || "";
    const subtitle = sizeName ? `${name} (${sizeName})` : name;
    const subtotal = Number(item.subtotal || 0);
    lines.push(...wrapText(`${qty}x ${subtitle}`));
    lines.push(leftRight("", formatMoneyMXN(subtotal)));
    if (item.customLabel) lines.push(...wrapText(`  * ${item.customLabel}`));
  }

  lines.push("------------------------------------------");
  lines.push(leftRight("TOTAL", formatMoneyMXN(total)));
  lines.push("==========================================");
  lines.push("Gracias por tu visita");
  return `${lines.join("\n")}\n`;
}

function renderKitchenText(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const orderNumber = payload.orderNumber || "---";
  const customerName = payload.customerName || "Barra";
  const dateStr = payload.dateStr || new Date().toLocaleString("es-MX");

  const lines = [];
  lines.push("COMANDA COCINA");
  lines.push("================================");
  lines.push(`#${orderNumber}`);
  lines.push(`Cliente: ${customerName}`);
  lines.push(`Hora: ${dateStr}`);
  lines.push("--------------------------------");
  for (const item of items) {
    const qty = Number(item.quantity || 0);
    const name = item?.product?.name || item?.name || "Item";
    const sizeName = item?.productSize?.name || item?.product_size?.name || "";
    const label = sizeName ? `${name} (${sizeName})` : name;
    lines.push(...wrapText(`${qty}x ${String(label).toUpperCase()}`, 32));
    if (item.customLabel) lines.push(...wrapText(`  * ${item.customLabel}`, 32));
  }
  lines.push("--------------------------------");
  lines.push("PREPARAR AHORA");
  return `${lines.join("\n")}\n`;
}

function renderCashCutText(payload) {
  const title = payload.title || "CORTE DE CAJA";
  const generatedAt = payload.generatedAt || new Date().toLocaleString("es-MX");
  const expectedCash = Number(payload.expectedCash || 0);
  const countedCash = Number(payload.countedCash || 0);
  const difference = Number(payload.difference || 0);
  const salesCount = Number(payload.salesCount || 0);

  const lines = [];
  lines.push(title);
  lines.push("==========================================");
  lines.push(`Fecha: ${generatedAt}`);
  lines.push(`Ventas (tickets): ${salesCount}`);
  lines.push(leftRight("Efectivo esperado", formatMoneyMXN(expectedCash)));
  lines.push(leftRight("Efectivo contado", formatMoneyMXN(countedCash)));
  lines.push(leftRight("Diferencia", formatMoneyMXN(difference)));
  lines.push("------------------------------------------");

  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  for (const entry of entries) {
    const label = `${entry.label || "Denominacion"} x ${entry.quantity || 0}`;
    const subtotal = Number(entry.value || 0) * Number(entry.quantity || 0);
    lines.push(leftRight(label, formatMoneyMXN(subtotal)));
  }

  lines.push("==========================================");
  return `${lines.join("\n")}\n`;
}

function runCommand(bin, args) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString("utf8");
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString("utf8");
    });
    child.on("close", (code) => resolve({ code: code || 0, stdout, stderr }));
    child.on("error", (err) => resolve({ code: 1, stdout, stderr: err.message }));
  });
}

async function sendTextToCups(queue, text, title) {
  const tmpFile = path.join(os.tmpdir(), `juliana-print-${Date.now()}-${generateId()}.txt`);
  await fs.writeFile(tmpFile, text, "utf8");
  const args = ["-d", queue, "-t", title || "Juliana Print"];
  if (PRINT_RAW) args.push("-o", "raw");
  args.push(tmpFile);
  const result = await runCommand("lp", args);
  await fs.unlink(tmpFile).catch(() => {});
  return result;
}

function enqueueJob({ type, queue, content, payload }) {
  const now = nowIso();
  const job = {
    id: generateId(),
    type,
    queue,
    content,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    printedAt: null,
    error: null,
  };
  inMemoryJobs.push(job);
  return job;
}

async function processOneJob() {
  if (workerActive) return;
  const next = inMemoryJobs.find(
    (j) =>
      (j.status === "pending" || j.status === "failed") &&
      j.attempts < MAX_RETRIES &&
      (!j.nextRetryAt || Date.now() >= j.nextRetryAt)
  );
  if (!next) return;

  workerActive = true;
  next.status = "processing";
  next.updatedAt = nowIso();
  await persistJobs();

  const result = await sendTextToCups(next.queue, next.content, `Juliana ${next.type}`);
  if (result.code === 0) {
    next.status = "printed";
    next.printedAt = nowIso();
    next.error = null;
  } else {
    next.status = "failed";
    next.error = (result.stderr || result.stdout || "Unknown CUPS error").trim().slice(0, 500);
    next.nextRetryAt = Date.now() + RETRY_DELAY_MS;
  }
  next.attempts += 1;
  next.updatedAt = nowIso();
  await persistJobs();
  workerActive = false;
}

function startWorker() {
  setInterval(() => {
    void processOneJob();
  }, 900);
}

app.get("/health", async (_req, res) => {
  const printerCheck = await runCommand("lpstat", ["-p"]);
  res.json({
    ok: true,
    now: nowIso(),
    queues: {
      ticket: CUPS_QUEUE_TICKET,
      kitchen: CUPS_QUEUE_KITCHEN,
      cashCut: CUPS_QUEUE_CASH_CUT,
    },
    cupsReachable: printerCheck.code === 0,
    cupsMessage: (printerCheck.stdout || printerCheck.stderr || "").trim(),
  });
});

app.get("/api/queues", requireToken, async (_req, res) => {
  const out = await runCommand("lpstat", ["-p", "-d"]);
  res.status(out.code === 0 ? 200 : 500).json({
    ok: out.code === 0,
    output: out.stdout || "",
    error: out.code === 0 ? null : out.stderr || "CUPS command failed",
  });
});

app.get("/api/jobs", requireToken, (req, res) => {
  const limit = Math.max(1, Math.min(200, Number.parseInt(req.query.limit || "50", 10)));
  const status = String(req.query.status || "").trim();
  let data = [...inMemoryJobs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (status) data = data.filter((job) => job.status === status);
  res.json({ ok: true, count: data.length, jobs: data.slice(0, limit) });
});

app.post("/api/jobs/:id/retry", requireToken, async (req, res) => {
  const job = inMemoryJobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ ok: false, error: "Job not found" });
  if (job.status === "printed") {
    return res.status(400).json({ ok: false, error: "Printed jobs cannot be retried" });
  }
  job.status = "pending";
  job.error = null;
  job.nextRetryAt = 0;
  job.updatedAt = nowIso();
  await persistJobs();
  return res.json({ ok: true, job });
});

app.post("/api/print/ticket", requireToken, async (req, res) => {
  const content = renderTicketText(req.body || {});
  const job = enqueueJob({
    type: "ticket",
    queue: CUPS_QUEUE_TICKET,
    content,
    payload: req.body || {},
  });
  await persistJobs();
  res.status(202).json({ ok: true, jobId: job.id, queue: job.queue, status: job.status });
});

app.post("/api/print/kitchen", requireToken, async (req, res) => {
  const content = renderKitchenText(req.body || {});
  const job = enqueueJob({
    type: "kitchen",
    queue: CUPS_QUEUE_KITCHEN,
    content,
    payload: req.body || {},
  });
  await persistJobs();
  res.status(202).json({ ok: true, jobId: job.id, queue: job.queue, status: job.status });
});

app.post("/api/print/cash-cut", requireToken, async (req, res) => {
  const content = renderCashCutText(req.body || {});
  const job = enqueueJob({
    type: "cash-cut",
    queue: CUPS_QUEUE_CASH_CUT,
    content,
    payload: req.body || {},
  });
  await persistJobs();
  res.status(202).json({ ok: true, jobId: job.id, queue: job.queue, status: job.status });
});

async function bootstrap() {
  await ensureJobStorage();
  startWorker();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[print-gateway] running on :${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`[print-gateway] queues ticket=${CUPS_QUEUE_TICKET} kitchen=${CUPS_QUEUE_KITCHEN} cash-cut=${CUPS_QUEUE_CASH_CUT}`);
  });
}

void bootstrap();
