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
}): CashOpening {
  const next: CashOpening = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    amount: Math.max(0, opening.amount),
    note: opening.note?.trim() || "Apertura de caja",
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

export function getTodaySalesRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from, to };
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  return method === "tarjeta" ? "Tarjeta" : "Efectivo";
}
