import { supabase } from "@/integrations/supabase/client";

export type PaymentMethod = "efectivo" | "tarjeta";
export type CashMovementType = "retiro" | "ingreso";

export interface CashRegisterSale {
  orderId: string;
  orderNumber: number;
  customerName: string;
  total: number;
  paymentMethod: PaymentMethod;
  createdAt: string;
}

const CASH_REGISTER_STORAGE_KEY = "cash_register_sales";
const CASH_WITHDRAWALS_STORAGE_KEY = "cash_register_withdrawals";
const CASH_MOVEMENTS_STORAGE_KEY = "cash_register_movements";
const CASH_OPENINGS_STORAGE_KEY = "cash_register_openings";
const CASH_CUTS_STORAGE_KEY = "cash_register_cuts";

export interface CashWithdrawal {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface CashOpening {
  id: string;
  amount: number;
  note: string;
  createdAt: string;
  sessionId?: string;
  denominations?: CashCutEntry[];
}

export interface CashCutEntry {
  label: string;
  value: number;
  quantity: number;
}

export interface CashCutRecord {
  id: string;
  createdAt: string;
  expectedCash: number;
  countedCash: number;
  difference: number;
  openingAmount: number;
  salesCount: number;
  cashSalesTotal: number;
  cardSalesTotal: number;
  depositsTotal: number;
  withdrawalsTotal: number;
  entries: CashCutEntry[];
  note?: string;
  sessionId?: string;
}

export interface CashRegisterSession {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  openingDenominations: CashCutEntry[];
  closingDenominations: CashCutEntry[];
  notes: string | null;
  status: "open" | "closed";
  createdAt: string;
}

function readSales(): CashRegisterSale[] {
  const raw = localStorage.getItem(CASH_REGISTER_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as CashRegisterSale[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSales(sales: CashRegisterSale[]): void {
  localStorage.setItem(CASH_REGISTER_STORAGE_KEY, JSON.stringify(sales));
}

export function registerPaidSale(sale: CashRegisterSale): void {
  const sales = readSales();
  sales.push(sale);
  writeSales(sales);
}

function readWithdrawals(): CashWithdrawal[] {
  const raw = localStorage.getItem(CASH_WITHDRAWALS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as CashWithdrawal[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeWithdrawals(withdrawals: CashWithdrawal[]): void {
  localStorage.setItem(CASH_WITHDRAWALS_STORAGE_KEY, JSON.stringify(withdrawals));
}

function readMovements(): CashMovement[] {
  const raw = localStorage.getItem(CASH_MOVEMENTS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as CashMovement[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMovements(movements: CashMovement[]): void {
  localStorage.setItem(CASH_MOVEMENTS_STORAGE_KEY, JSON.stringify(movements));
}

function readOpenings(): CashOpening[] {
  const raw = localStorage.getItem(CASH_OPENINGS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as CashOpening[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOpenings(openings: CashOpening[]): void {
  localStorage.setItem(CASH_OPENINGS_STORAGE_KEY, JSON.stringify(openings));
}

function readCashCuts(): CashCutRecord[] {
  const raw = localStorage.getItem(CASH_CUTS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as CashCutRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCashCuts(cuts: CashCutRecord[]): void {
  localStorage.setItem(CASH_CUTS_STORAGE_KEY, JSON.stringify(cuts));
}

function toCashEntries(value: unknown): CashCutEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const maybe = entry as Partial<CashCutEntry>;
      const label = typeof maybe.label === "string" ? maybe.label : "";
      const parsedValue = Number(maybe.value);
      const parsedQty = Number(maybe.quantity);
      if (!Number.isFinite(parsedValue) || !Number.isFinite(parsedQty)) return null;
      return {
        label,
        value: parsedValue,
        quantity: Math.max(0, Math.floor(parsedQty)),
      };
    })
    .filter((entry): entry is CashCutEntry => Boolean(entry));
}

function mapSessionRow(row: {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number;
  closing_amount: number | null;
  expected_amount: number | null;
  difference: number | null;
  opening_denominations: unknown;
  closing_denominations: unknown;
  notes: string | null;
  status: string;
  created_at: string;
}): CashRegisterSession {
  return {
    id: row.id,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openingAmount: Number(row.opening_amount || 0),
    closingAmount: row.closing_amount == null ? null : Number(row.closing_amount),
    expectedAmount: row.expected_amount == null ? null : Number(row.expected_amount),
    difference: row.difference == null ? null : Number(row.difference),
    openingDenominations: toCashEntries(row.opening_denominations),
    closingDenominations: toCashEntries(row.closing_denominations),
    notes: row.notes,
    status: row.status === "closed" ? "closed" : "open",
    createdAt: row.created_at,
  };
}

function migrateLegacyWithdrawalsToMovements(): void {
  const movements = readMovements();
  if (movements.length > 0) return;

  const withdrawals = readWithdrawals();
  if (withdrawals.length === 0) return;

  const migrated = withdrawals.map((w) => ({
    id: w.id,
    type: "retiro" as const,
    amount: w.amount,
    reason: w.reason,
    createdAt: w.createdAt,
  }));
  writeMovements(migrated);
}

export function registerCashWithdrawal(withdrawal: Omit<CashWithdrawal, "id" | "createdAt">): CashWithdrawal {
  return registerCashMovement({
    type: "retiro",
    amount: withdrawal.amount,
    reason: withdrawal.reason,
  });
}

export function registerCashMovement(movement: {
  type: CashMovementType;
  amount: number;
  reason: string;
}): CashMovement {
  migrateLegacyWithdrawalsToMovements();
  const next: CashMovement = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    type: movement.type,
    amount: Math.max(0, movement.amount),
    reason:
      movement.reason.trim() ||
      (movement.type === "ingreso" ? "Ingreso a caja" : "Retiro de caja"),
  };

  const movements = readMovements();
  movements.push(next);
  writeMovements(movements);
  return next;
}

export function registerCashOpening(opening: {
  amount: number;
  note?: string;
  sessionId?: string;
  denominations?: CashCutEntry[];
}): CashOpening {
  const next: CashOpening = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    amount: Math.max(0, opening.amount),
    note: opening.note?.trim() || "Apertura de caja",
    sessionId: opening.sessionId,
    denominations: opening.denominations || [],
  };

  const openings = readOpenings();
  openings.push(next);
  writeOpenings(openings);
  return next;
}

export function getCashRegisterSales(filter?: { dateFrom?: Date; dateTo?: Date }): CashRegisterSale[] {
  let sales = readSales();

  if (filter?.dateFrom) {
    sales = sales.filter((sale) => new Date(sale.createdAt) >= filter.dateFrom!);
  }
  if (filter?.dateTo) {
    sales = sales.filter((sale) => new Date(sale.createdAt) <= filter.dateTo!);
  }

  return sales.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function getCashWithdrawals(filter?: { dateFrom?: Date; dateTo?: Date }): CashWithdrawal[] {
  migrateLegacyWithdrawalsToMovements();
  let withdrawals = readMovements()
    .filter((m) => m.type === "retiro")
    .map((m) => ({
      id: m.id,
      amount: m.amount,
      reason: m.reason,
      createdAt: m.createdAt,
    }));

  if (filter?.dateFrom) {
    withdrawals = withdrawals.filter((entry) => new Date(entry.createdAt) >= filter.dateFrom!);
  }
  if (filter?.dateTo) {
    withdrawals = withdrawals.filter((entry) => new Date(entry.createdAt) <= filter.dateTo!);
  }

  return withdrawals.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function getCashMovements(filter?: { dateFrom?: Date; dateTo?: Date }): CashMovement[] {
  migrateLegacyWithdrawalsToMovements();
  let movements = readMovements();

  if (filter?.dateFrom) {
    movements = movements.filter((entry) => new Date(entry.createdAt) >= filter.dateFrom!);
  }
  if (filter?.dateTo) {
    movements = movements.filter((entry) => new Date(entry.createdAt) <= filter.dateTo!);
  }

  return movements.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function getCashOpenings(filter?: { dateFrom?: Date; dateTo?: Date }): CashOpening[] {
  let openings = readOpenings();

  if (filter?.dateFrom) {
    openings = openings.filter((entry) => new Date(entry.createdAt) >= filter.dateFrom!);
  }
  if (filter?.dateTo) {
    openings = openings.filter((entry) => new Date(entry.createdAt) <= filter.dateTo!);
  }

  return openings.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export function registerCashCut(cut: Omit<CashCutRecord, "id" | "createdAt">): CashCutRecord {
  const next: CashCutRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    expectedCash: cut.expectedCash,
    countedCash: cut.countedCash,
    difference: cut.difference,
    openingAmount: cut.openingAmount,
    salesCount: cut.salesCount,
    cashSalesTotal: cut.cashSalesTotal,
    cardSalesTotal: cut.cardSalesTotal,
    depositsTotal: cut.depositsTotal,
    withdrawalsTotal: cut.withdrawalsTotal,
    entries: cut.entries,
    note: cut.note,
    sessionId: cut.sessionId,
  };

  const cuts = readCashCuts();
  cuts.push(next);
  writeCashCuts(cuts);
  return next;
}

export function getCashCuts(filter?: { dateFrom?: Date; dateTo?: Date }): CashCutRecord[] {
  let cuts = readCashCuts();

  if (filter?.dateFrom) {
    cuts = cuts.filter((entry) => new Date(entry.createdAt) >= filter.dateFrom!);
  }
  if (filter?.dateTo) {
    cuts = cuts.filter((entry) => new Date(entry.createdAt) <= filter.dateTo!);
  }

  return cuts.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getTodaySalesRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from, to };
}

export async function openCashRegisterSession(input: {
  openingAmount: number;
  openingDenominations?: CashCutEntry[];
  notes?: string;
}): Promise<CashRegisterSession> {
  const { data, error } = await supabase
    .from("cash_register_sessions")
    .insert({
      opening_amount: Math.max(0, input.openingAmount),
      opening_denominations: input.openingDenominations || [],
      notes: input.notes?.trim() || "Apertura de caja",
      status: "open",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("No se pudo abrir la sesión de caja.");
  }

  return mapSessionRow(data);
}

export async function getOpenCashRegisterSessionToday(): Promise<CashRegisterSession | null> {
  const { from, to } = getTodaySalesRange();
  const { data, error } = await supabase
    .from("cash_register_sessions")
    .select("*")
    .eq("status", "open")
    .gte("opened_at", from.toISOString())
    .lte("opened_at", to.toISOString())
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) return null;
  return mapSessionRow(data);
}

export async function closeCashRegisterSession(input: {
  sessionId: string;
  closingAmount: number;
  expectedAmount: number;
  difference: number;
  closingDenominations?: CashCutEntry[];
  notes?: string;
}): Promise<CashRegisterSession> {
  const { data, error } = await supabase
    .from("cash_register_sessions")
    .update({
      closed_at: new Date().toISOString(),
      closing_amount: input.closingAmount,
      expected_amount: input.expectedAmount,
      difference: input.difference,
      closing_denominations: input.closingDenominations || [],
      notes: input.notes?.trim() || "Corte de caja",
      status: "closed",
    })
    .eq("id", input.sessionId)
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("No se pudo cerrar la sesión de caja.");
  }

  return mapSessionRow(data);
}

export function isCashRegisterOpenToday(): boolean {
  const { from, to } = getTodaySalesRange();
  const openings = getCashOpenings({ dateFrom: from, dateTo: to });
  if (openings.length === 0) return false;

  const cuts = getCashCuts({ dateFrom: from, dateTo: to });
  if (cuts.length === 0) return true;

  const lastOpeningAt = new Date(openings[openings.length - 1].createdAt).getTime();
  const lastCutAt = new Date(cuts[0].createdAt).getTime();
  return lastOpeningAt > lastCutAt;
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  return method === "tarjeta" ? "Tarjeta" : "Efectivo";
}
