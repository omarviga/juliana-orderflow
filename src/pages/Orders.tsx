import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { useOrders } from "@/hooks/useOrders";
import { useBluetootPrinter } from "@/hooks/useBluetootPrinter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronRight, Printer } from "lucide-react";
import type { OrderWithItems } from "@/hooks/useOrders";
import {
  getCashCuts,
  getCashOpenings,
  getCashRegisterSales,
  getCashMovements,
  getTodaySalesRange,
  registerCashCut,
  registerCashOpening,
  registerCashMovement,
  type CashCutRecord,
  type CashOpening,
  type CashMovement,
  type CashMovementType,
  type CashRegisterSale,
} from "@/lib/cash-register";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyMXN } from "@/lib/currency";

const CASH_DENOMINATIONS = [
  { key: "1000", label: "Billete $1000", value: 1000 },
  { key: "500", label: "Billete $500", value: 500 },
  { key: "200", label: "Billete $200", value: 200 },
  { key: "100", label: "Billete $100", value: 100 },
  { key: "50b", label: "Billete $50", value: 50 },
  { key: "20b", label: "Billete $20", value: 20 },
  { key: "20m", label: "Moneda $20", value: 20 },
  { key: "10m", label: "Moneda $10", value: 10 },
  { key: "5m", label: "Moneda $5", value: 5 },
  { key: "2m", label: "Moneda $2", value: 2 },
  { key: "1m", label: "Moneda $1", value: 1 },
  { key: "050m", label: "Moneda $0.50", value: 0.5 },
];

function createInitialCounts(): Record<string, number> {
  return Object.fromEntries(CASH_DENOMINATIONS.map((den) => [den.key, 0]));
}

interface SoldProductSummary {
  name: string;
  quantity: number;
  total: number;
}

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "pendiente" | "pagado" | "cancelado" | "all"
  >("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(
    null
  );
  const [cashCutOpen, setCashCutOpen] = useState(false);
  const [cashOpeningOpen, setCashOpeningOpen] = useState(false);
  const [cashMovementOpen, setCashMovementOpen] = useState(false);
  const [cashMovementType, setCashMovementType] = useState<CashMovementType>("retiro");
  const [cashCounts, setCashCounts] = useState<Record<string, number>>(createInitialCounts);
  const [salesForCut, setSalesForCut] = useState<CashRegisterSale[]>([]);
  const [openingForCut, setOpeningForCut] = useState<CashOpening | null>(null);
  const [movementsForCut, setMovementsForCut] = useState<CashMovement[]>([]);
  const [cutsForToday, setCutsForToday] = useState<CashCutRecord[]>([]);
  const [soldProductsForCut, setSoldProductsForCut] = useState<SoldProductSummary[]>([]);
  const [isFallbackSales, setIsFallbackSales] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const printer = useBluetootPrinter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsTouchDevice(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const { orders, isLoading, updateOrderStatus, isUpdating } = useOrders({
    status: statusFilter === "all" ? undefined : statusFilter,
    searchTerm: searchTerm || undefined,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pendiente":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "pagado":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "cancelado":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pendiente":
        return "Pendiente";
      case "pagado":
        return "Pagado";
      case "cancelado":
        return "Cancelado";
      default:
        return status;
    }
  };

  const expectedCash = useMemo(
    () =>
      salesForCut
        .filter((sale) => sale.paymentMethod === "efectivo")
        .reduce((sum, sale) => sum + sale.total, 0),
    [salesForCut]
  );

  const countedCash = useMemo(
    () =>
      CASH_DENOMINATIONS.reduce(
        (sum, denomination) => sum + denomination.value * (cashCounts[denomination.key] || 0),
        0
      ),
    [cashCounts]
  );

  const openingAmountForCut = openingForCut?.amount || 0;
  const withdrawalsForCut = useMemo(
    () => movementsForCut.filter((entry) => entry.type === "retiro"),
    [movementsForCut]
  );
  const depositsForCut = useMemo(
    () => movementsForCut.filter((entry) => entry.type === "ingreso"),
    [movementsForCut]
  );
  const totalWithdrawals = useMemo(
    () => withdrawalsForCut.reduce((sum, entry) => sum + entry.amount, 0),
    [withdrawalsForCut]
  );
  const totalDeposits = useMemo(
    () => depositsForCut.reduce((sum, entry) => sum + entry.amount, 0),
    [depositsForCut]
  );
  const cardSalesTotal = useMemo(
    () =>
      salesForCut
        .filter((sale) => sale.paymentMethod === "tarjeta")
        .reduce((sum, sale) => sum + sale.total, 0),
    [salesForCut]
  );
  const cardTransactionsCount = useMemo(
    () => salesForCut.filter((sale) => sale.paymentMethod === "tarjeta").length,
    [salesForCut]
  );
  const expectedCashNet = openingAmountForCut + expectedCash + totalDeposits - totalWithdrawals;
  const cashDifference = countedCash - expectedCashNet;

  const loadTodaySales = () => {
    const { from, to } = getTodaySalesRange();
    return getCashRegisterSales({ dateFrom: from, dateTo: to });
  };
  const loadTodayMovements = () => {
    const { from, to } = getTodaySalesRange();
    return getCashMovements({ dateFrom: from, dateTo: to });
  };

  const loadTodayOpening = () => {
    const { from, to } = getTodaySalesRange();
    const openings = getCashOpenings({ dateFrom: from, dateTo: to });
    return openings.length > 0 ? openings[openings.length - 1] : null;
  };

  const loadTodayCuts = () => {
    const { from, to } = getTodaySalesRange();
    return getCashCuts({ dateFrom: from, dateTo: to });
  };

  const loadTodaySoldProducts = async (): Promise<SoldProductSummary[]> => {
    const { from, to } = getTodaySalesRange();
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        created_at,
        status,
        order_items(
          quantity,
          subtotal,
          product:products(name)
        )
      `
      )
      .eq("status", "pagado")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString());

    if (error) {
      throw error;
    }

    const productMap = new Map<string, SoldProductSummary>();
    for (const order of data || []) {
      for (const item of order.order_items || []) {
        const name = item.product?.name || "Producto";
        const existing = productMap.get(name) || { name, quantity: 0, total: 0 };
        existing.quantity += Number(item.quantity || 0);
        existing.total += Number(item.subtotal || 0);
        productMap.set(name, existing);
      }
    }

    return [...productMap.values()].sort((a, b) => b.quantity - a.quantity || b.total - a.total);
  };

  const loadTodayPaidOrdersFallback = async (): Promise<CashRegisterSale[]> => {
    const { from, to } = getTodaySalesRange();
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, total, created_at")
      .eq("status", "pagado")
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((order) => ({
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name || "Mostrador",
      total: order.total,
      // The schema does not persist payment method in orders yet.
      paymentMethod: "efectivo",
      createdAt: order.created_at,
    }));
  };

  const handleOpenCashCut = async () => {
    const todaySales = loadTodaySales();
    const todayMovements = loadTodayMovements();
    const todayOpening = loadTodayOpening();
    if (!todayOpening) {
      toast.error("Primero debes registrar la apertura de caja del día.");
      setCashOpeningOpen(true);
      return;
    }

    setSoldProductsForCut([]);
    setMovementsForCut(todayMovements);
    setOpeningForCut(todayOpening);
    setCutsForToday(loadTodayCuts());
    try {
      const productsSummary = await loadTodaySoldProducts();
      setSoldProductsForCut(productsSummary);
    } catch {
      setSoldProductsForCut([]);
      toast.error("No se pudo cargar el desglose de productos del día.");
    }
    if (todaySales.length > 0) {
      setIsFallbackSales(false);
      setSalesForCut(todaySales);
      setCashCutOpen(true);
      return;
    }

    try {
      const fallbackSales = await loadTodayPaidOrdersFallback();
      setIsFallbackSales(fallbackSales.length > 0);
      setSalesForCut(fallbackSales);
      setCashCutOpen(true);

      if (fallbackSales.length === 0) {
        toast.info("No hay ventas registradas hoy. Puedes capturar conteo e imprimir en cero.");
      } else {
        toast.warning("Se cargaron ventas desde pedidos; método de pago asumido como efectivo.");
      }
    } catch {
      setIsFallbackSales(false);
      setSalesForCut([]);
      setMovementsForCut(todayMovements);
      setCashCutOpen(true);
      toast.error("No se pudieron cargar las ventas del día.");
    }
  };

  const handleRegisterOpening = () => {
    const amount = Number.parseFloat(openingAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Ingresa un monto válido para la apertura.");
      return;
    }

    const saved = registerCashOpening({
      amount,
      note: openingNote.trim() || "Apertura de caja",
    });

    setOpeningForCut(saved);
    setOpeningAmount("");
    setOpeningNote("");
    setCashOpeningOpen(false);
    toast.success(`Apertura registrada por ${formatCurrencyMXN(saved.amount)}`);
  };

  const handleRegisterCashMovement = () => {
    const amount = Number.parseFloat(movementAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Ingresa un monto válido.");
      return;
    }

    const saved = registerCashMovement({
      type: cashMovementType,
      amount,
      reason:
        movementReason.trim() ||
        (cashMovementType === "ingreso" ? "Ingreso a caja" : "Retiro de caja"),
    });

    setMovementsForCut(loadTodayMovements());
    setMovementAmount("");
    setMovementReason("");
    setCashMovementOpen(false);
    toast.success(
      `${cashMovementType === "ingreso" ? "Ingreso" : "Retiro"} registrado por ${formatCurrencyMXN(saved.amount)}`
    );
  };

  const setDenominationCount = (key: string, nextValue: number) => {
    const safeValue = Number.isFinite(nextValue) && nextValue > 0 ? Math.floor(nextValue) : 0;
    setCashCounts((prev) => ({ ...prev, [key]: safeValue }));
  };

  const handlePrintCashCutToday = async () => {
    if (!openingForCut) {
      toast.error("No hay apertura de caja registrada para hoy.");
      setCashCutOpen(false);
      setCashOpeningOpen(true);
      return;
    }

    const generatedAt = new Date().toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const entries = CASH_DENOMINATIONS.map((denomination) => ({
      label: denomination.label,
      value: denomination.value,
      quantity: cashCounts[denomination.key] || 0,
    }));

    try {
      await printer.printCashCutTicket(
        salesForCut,
        generatedAt,
        "CORTE DE CAJA (HOY)",
        {
          expectedCash: expectedCashNet,
          countedCash,
          difference: cashDifference,
          entries,
        },
        {
          opening: openingForCut
            ? {
                amount: openingForCut.amount,
                note: openingForCut.note,
                createdAt: openingForCut.createdAt,
              }
            : null,
          products: soldProductsForCut,
          deposits: depositsForCut.map((entry) => ({
            amount: entry.amount,
            reason: entry.reason,
            createdAt: entry.createdAt,
          })),
          withdrawals: withdrawalsForCut.map((entry) => ({
            amount: entry.amount,
            reason: entry.reason,
            createdAt: entry.createdAt,
          })),
          cardTransactions: salesForCut
            .filter((sale) => sale.paymentMethod === "tarjeta")
            .map((sale) => ({
              orderNumber: sale.orderNumber,
              customerName: sale.customerName,
              total: sale.total,
              createdAt: sale.createdAt,
            })),
        }
      );
    } catch {
      toast.error("No se pudo imprimir el corte. No se registró el cierre.");
      return;
    }

    const cashSalesTotal = salesForCut
      .filter((sale) => sale.paymentMethod === "efectivo")
      .reduce((sum, sale) => sum + sale.total, 0);

    const cardSalesTotalLocal = salesForCut
      .filter((sale) => sale.paymentMethod === "tarjeta")
      .reduce((sum, sale) => sum + sale.total, 0);

    const savedCut = registerCashCut({
      expectedCash: expectedCashNet,
      countedCash,
      difference: cashDifference,
      openingAmount: openingForCut.amount,
      salesCount: salesForCut.length,
      cashSalesTotal,
      cardSalesTotal: cardSalesTotalLocal,
      depositsTotal: totalDeposits,
      withdrawalsTotal: totalWithdrawals,
      entries,
      note: "CORTE DE CAJA (HOY)",
    });

    setCutsForToday(loadTodayCuts());
    toast.success(`Corte registrado correctamente (folio ${savedCut.id.slice(0, 8)}).`);
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestiona y consulta todos los pedidos realizados
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-sm font-medium text-foreground">
            Buscar por número o cliente
          </label>
          <Input
            placeholder="Ej: #123 o Juan"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-2"
          />
        </div>

        <div className="w-full sm:w-48">
          <label className="text-sm font-medium text-foreground">Estado</label>
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(
                v as "pendiente" | "pagado" | "cancelado" | "all"
              )
            }
          >
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="pagado">Pagado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          className="sm:ml-auto"
          onClick={() => setCashOpeningOpen(true)}
        >
          Apertura de Caja
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setCashMovementType("retiro");
            setCashMovementOpen(true);
          }}
        >
          Retirar Efectivo
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setCashMovementType("ingreso");
            setCashMovementOpen(true);
          }}
        >
          Ingresar Efectivo
        </Button>

        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={handleOpenCashCut}
        >
          <Printer className="h-4 w-4" />
          Corte de Caja (Hoy)
        </Button>
      </div>

      {/* Tabla de Pedidos */}
      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-center">
            <div>
              <p className="text-lg font-medium text-foreground">
                No hay pedidos
              </p>
              <p className="text-sm text-muted-foreground">
                Intenta cambiar los filtros de búsqueda
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="cursor-pointer hover:bg-accent">
                  <TableCell className="font-medium">
                    #{order.order_number}
                  </TableCell>
                  <TableCell>{order.customer_name || "---"}</TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrencyMXN(order.total, 0)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`${getStatusColor(order.status)}`}
                      variant="outline"
                    >
                      {getStatusLabel(order.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", {
                      locale: es,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedOrder(order)}
                      className="gap-1"
                    >
                      Ver <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={cashCutOpen} onOpenChange={setCashCutOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Corte de Caja (Hoy)</DialogTitle>
            <DialogDescription>
              Revisa ventas, conteo de efectivo y registra el corte del día.
            </DialogDescription>
          </DialogHeader>
          {isFallbackSales && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Ventas cargadas desde pedidos pagados de hoy. El método de pago se asume como efectivo.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-7">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Ventas registradas</p>
              <p className="text-xl font-bold text-foreground">{salesForCut.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Apertura</p>
              <p className="text-xl font-bold text-foreground">{formatCurrencyMXN(openingAmountForCut)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Efectivo esperado</p>
              <p className="text-xl font-bold text-foreground">{formatCurrencyMXN(expectedCashNet, 0)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Tarjeta ({cardTransactionsCount})</p>
              <p className="text-xl font-bold text-blue-700">{formatCurrencyMXN(cardSalesTotal)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Ingresos a caja</p>
              <p className="text-xl font-bold text-emerald-700">{formatCurrencyMXN(totalDeposits)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Retiros de efectivo</p>
              <p className="text-xl font-bold text-amber-700">{formatCurrencyMXN(totalWithdrawals)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Efectivo contado</p>
              <p className="text-xl font-bold text-primary">{formatCurrencyMXN(countedCash)}</p>
            </div>
          </div>

          <div className="max-h-[45vh] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Denominación</TableHead>
                  <TableHead className="w-28 text-right">Cantidad</TableHead>
                  <TableHead className="w-28 text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CASH_DENOMINATIONS.map((denomination) => {
                  const quantity = cashCounts[denomination.key] || 0;
                  const subtotal = denomination.value * quantity;
                  return (
                    <TableRow key={denomination.key}>
                      <TableCell>{denomination.label}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 px-0"
                            onClick={() => setDenominationCount(denomination.key, quantity - 1)}
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            min="0"
                            value={quantity}
                            className="h-8 w-20 text-right"
                            readOnly={isTouchDevice}
                            inputMode="numeric"
                            enterKeyHint="done"
                            onChange={(event) => {
                              const raw = Number.parseInt(event.target.value || "0", 10);
                              const next = Number.isNaN(raw) || raw < 0 ? 0 : raw;
                              setDenominationCount(denomination.key, next);
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 px-0"
                            onClick={() => setDenominationCount(denomination.key, quantity + 1)}
                          >
                            +
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrencyMXN(subtotal)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium text-foreground">Productos vendidos</p>
            <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {soldProductsForCut.length === 0 ? (
                <p className="text-muted-foreground">Sin productos vendidos hoy.</p>
              ) : (
                soldProductsForCut.map((product) => (
                  <div key={product.name} className="flex items-center justify-between gap-2">
                    <span className="truncate">{product.name} x{product.quantity}</span>
                    <span className="font-medium">{formatCurrencyMXN(product.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium text-foreground">Apertura de caja</p>
              <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {!openingForCut ? (
                  <p className="text-muted-foreground">Sin apertura registrada hoy.</p>
                ) : (
                  <div className="rounded border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{formatCurrencyMXN(openingForCut.amount)}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(openingForCut.createdAt), "HH:mm", { locale: es })}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{openingForCut.note}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium text-foreground">Ingresos a caja</p>
              <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {depositsForCut.length === 0 ? (
                  <p className="text-muted-foreground">Sin ingresos registrados hoy.</p>
                ) : (
                  depositsForCut.map((entry) => (
                    <div key={entry.id} className="rounded border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-emerald-700">{formatCurrencyMXN(entry.amount)}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(entry.createdAt), "HH:mm", { locale: es })}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{entry.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium text-foreground">Retiros de efectivo</p>
              <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {withdrawalsForCut.length === 0 ? (
                  <p className="text-muted-foreground">Sin retiros registrados hoy.</p>
                ) : (
                  withdrawalsForCut.map((entry) => (
                    <div key={entry.id} className="rounded border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-amber-700">{formatCurrencyMXN(entry.amount)}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(entry.createdAt), "HH:mm", { locale: es })}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{entry.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium text-foreground">Transacciones con tarjeta</p>
              <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {salesForCut.filter((sale) => sale.paymentMethod === "tarjeta").length === 0 ? (
                  <p className="text-muted-foreground">Sin pagos con tarjeta hoy.</p>
                ) : (
                  salesForCut
                    .filter((sale) => sale.paymentMethod === "tarjeta")
                    .map((sale) => (
                      <div key={`${sale.orderId}-card`} className="flex items-center justify-between gap-2 rounded border p-2">
                        <span className="truncate">#{sale.orderNumber} {sale.customerName}</span>
                        <span className="font-medium">{formatCurrencyMXN(sale.total)}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium text-foreground">Diferencia (contado - esperado neto)</span>
            <span
              className={`text-lg font-bold ${cashDifference < 0 ? "text-red-600" : cashDifference > 0 ? "text-amber-600" : "text-green-600"}`}
            >
              {formatCurrencyMXN(cashDifference)}
            </span>
          </div>

          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium text-foreground">Cortes registrados hoy</p>
            <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {cutsForToday.length === 0 ? (
                <p className="text-muted-foreground">Sin cortes registrados hoy.</p>
              ) : (
                cutsForToday.map((cut) => (
                  <div key={cut.id} className="rounded border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Folio {cut.id.slice(0, 8)}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(cut.createdAt), "HH:mm", { locale: es })}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span>Esperado {formatCurrencyMXN(cut.expectedCash)}</span>
                      <span>Contado {formatCurrencyMXN(cut.countedCash)}</span>
                      <span className={cut.difference === 0 ? "text-green-600" : "text-amber-700"}>
                        Dif. {formatCurrencyMXN(cut.difference)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCashCounts(createInitialCounts())}
            >
              Limpiar conteo
            </Button>
            <Button className="ml-auto gap-2" onClick={handlePrintCashCutToday}>
              <Printer className="h-4 w-4" />
              Registrar e imprimir corte 80mm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cashOpeningOpen} onOpenChange={setCashOpeningOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apertura de Caja</DialogTitle>
            <DialogDescription>
              Captura el fondo inicial para abrir la caja.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Monto inicial</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
                placeholder="Ej. 1000"
                inputMode="decimal"
                enterKeyHint="done"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Nota</label>
              <Input
                value={openingNote}
                onChange={(event) => setOpeningNote(event.target.value)}
                placeholder="Fondo inicial"
              />
            </div>
            <Button className="w-full" onClick={handleRegisterOpening}>
              Guardar apertura
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cashMovementOpen} onOpenChange={setCashMovementOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {cashMovementType === "ingreso" ? "Ingreso de Efectivo" : "Retiro de Efectivo"}
            </DialogTitle>
            <DialogDescription>
              Registra el monto y motivo del movimiento de caja.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Monto</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={movementAmount}
                onChange={(event) => setMovementAmount(event.target.value)}
                placeholder="Ej. 500"
                inputMode="decimal"
                enterKeyHint="done"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Motivo</label>
              <Input
                value={movementReason}
                onChange={(event) => setMovementReason(event.target.value)}
                placeholder="Caja chica, depósito, etc."
              />
            </div>
            <Button className="w-full" onClick={handleRegisterCashMovement}>
              Guardar {cashMovementType}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Pedido #{selectedOrder?.order_number}
            </DialogTitle>
            <DialogDescription>
              Consulta el detalle completo del pedido seleccionado.
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Info General */}
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium text-foreground">
                    {selectedOrder.customer_name || "Sin nombre"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <Badge
                    className={`${getStatusColor(selectedOrder.status)} w-fit`}
                  >
                    {getStatusLabel(selectedOrder.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrencyMXN(selectedOrder.total, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-medium text-foreground">
                    {format(new Date(selectedOrder.created_at), "dd/MM/yyyy HH:mm", {
                      locale: es,
                    })}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div>
                <h3 className="mb-3 font-semibold text-foreground">
                  Artículos
                </h3>
                <div className="space-y-2">
                  {selectedOrder.order_items?.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between rounded-lg border p-3"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {item.quantity}x {item.product?.name}
                          {item.product_size && ` (${item.product_size.name})`}
                        </p>
                        {item.custom_label && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.custom_label}
                          </p>
                        )}
                        {item.customizations &&
                          item.customizations.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {item.customizations.map((c) => (
                                <p
                                  key={c.id}
                                  className="text-xs text-muted-foreground"
                                >
                                  • {c.ingredient?.name}
                                </p>
                              ))}
                            </div>
                          )}
                      </div>
                      <div className="text-right font-semibold text-foreground">
                        {formatCurrencyMXN(item.subtotal, 0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cambiar Estado */}
              {selectedOrder.status !== "cancelado" && (
                <div className="space-y-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/30 dark:bg-yellow-900/10">
                  <p className="text-sm font-medium text-foreground">
                    Cambiar estado del pedido
                  </p>
                  <div className="flex gap-2">
                    {selectedOrder.status === "pendiente" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            updateOrderStatus({
                              orderId: selectedOrder.id,
                              status: "pagado",
                            });
                            setSelectedOrder(null);
                          }}
                          disabled={isUpdating}
                        >
                          Marcar como Pagado
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            updateOrderStatus({
                              orderId: selectedOrder.id,
                              status: "cancelado",
                            });
                            setSelectedOrder(null);
                          }}
                          disabled={isUpdating}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                    {selectedOrder.status === "pagado" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          updateOrderStatus({
                            orderId: selectedOrder.id,
                            status: "cancelado",
                          });
                          setSelectedOrder(null);
                        }}
                        disabled={isUpdating}
                      >
                        Cancelar Pedido
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </Layout>
  );
}
