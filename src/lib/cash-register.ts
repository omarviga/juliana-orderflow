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

export function getTodaySalesRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from, to };
}

export function getPaymentMethodLabel(method: PaymentMethod): string {
  return method === "tarjeta" ? "Tarjeta" : "Efectivo";
}

