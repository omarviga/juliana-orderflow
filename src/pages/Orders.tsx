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
  getCashRegisterSales,
  getTodaySalesRange,
  type CashRegisterSale,
} from "@/lib/cash-register";
import { toast } from "sonner";

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

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "pendiente" | "pagado" | "cancelado" | "all"
  >("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(
    null
  );
  const [cashCutOpen, setCashCutOpen] = useState(false);
  const [cashCounts, setCashCounts] = useState<Record<string, number>>(createInitialCounts);
  const [salesForCut, setSalesForCut] = useState<CashRegisterSale[]>([]);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
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

  const cashDifference = countedCash - expectedCash;

  const loadTodaySales = () => {
    const { from, to } = getTodaySalesRange();
    return getCashRegisterSales({ dateFrom: from, dateTo: to });
  };

  const handleOpenCashCut = () => {
    const todaySales = loadTodaySales();
    setSalesForCut(todaySales);
    setCashCutOpen(true);
    if (todaySales.length === 0) {
      toast.info("No hay ventas registradas hoy. Puedes capturar conteo e imprimir en cero.");
    }
  };

  const setDenominationCount = (key: string, nextValue: number) => {
    const safeValue = Number.isFinite(nextValue) && nextValue > 0 ? Math.floor(nextValue) : 0;
    setCashCounts((prev) => ({ ...prev, [key]: safeValue }));
  };

  const handlePrintCashCutToday = async () => {
    const generatedAt = new Date().toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    await printer.printCashCutTicket(salesForCut, generatedAt, "CORTE DE CAJA (HOY)", {
      expectedCash,
      countedCash,
      difference: cashDifference,
      entries: CASH_DENOMINATIONS.map((denomination) => ({
        label: denomination.label,
        value: denomination.value,
        quantity: cashCounts[denomination.key] || 0,
      })),
    });
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
          className="gap-2 sm:ml-auto"
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
                    ${order.total.toFixed(0)}
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
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Ventas registradas</p>
              <p className="text-xl font-bold text-foreground">{salesForCut.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Efectivo esperado</p>
              <p className="text-xl font-bold text-foreground">${expectedCash.toFixed(0)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Efectivo contado</p>
              <p className="text-xl font-bold text-primary">${countedCash.toFixed(2)}</p>
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
                        ${subtotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium text-foreground">Diferencia (contado - esperado)</span>
            <span
              className={`text-lg font-bold ${cashDifference < 0 ? "text-red-600" : cashDifference > 0 ? "text-amber-600" : "text-green-600"}`}
            >
              ${cashDifference.toFixed(2)}
            </span>
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
              Imprimir corte 80mm
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
                    ${selectedOrder.total.toFixed(0)}
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
                        ${item.subtotal.toFixed(0)}
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
