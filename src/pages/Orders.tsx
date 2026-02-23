import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useOrders } from "@/hooks/useOrders";
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
import { ChevronRight, X } from "lucide-react";
import type { OrderWithItems } from "@/hooks/useOrders";

export default function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "pendiente" | "pagado" | "cancelado" | "all"
  >("all");
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(
    null
  );

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
