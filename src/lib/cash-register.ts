export type PaymentMethod = "efectivo" | "tarjeta";

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

export interface CashWithdrawal {
  id: string;
  amount: number;
  reason: string;
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

export function registerCashWithdrawal(withdrawal: Omit<CashWithdrawal, "id" | "createdAt">): CashWithdrawal {
  const next: CashWithdrawal = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    amount: Math.max(0, withdrawal.amount),
    reason: withdrawal.reason.trim() || "Retiro de caja",
  };

  const withdrawals = readWithdrawals();
  withdrawals.push(next);
  writeWithdrawals(withdrawals);
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
  let withdrawals = readWithdrawals();

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

export function getTodaySalesRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from, to };
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  return method === "tarjeta" ? "Tarjeta" : "Efectivo";
}
