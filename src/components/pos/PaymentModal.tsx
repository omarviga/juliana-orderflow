import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CartItem } from "@/types/pos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Printer, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useBluetootPrinter } from "@/hooks/useBluetootPrinter";
import { useBluetoothPrintApp } from "@/hooks/useBluetoothPrintApp";
import {
  getPaymentMethodLabel,
  registerPaidSale,
  type PaymentMethod,
} from "@/lib/cash-register";
import {
  enqueueOfflineOrder,
  syncPendingOfflineOrders,
  type OfflineOrderPayload,
} from "@/lib/offline-orders";
import { formatCurrencyMXN } from "@/lib/currency";

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

interface Props {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
  onOrderComplete: () => void;
  canProcessPayment?: boolean;
}

export function PaymentModal({
  open,
  onClose,
  items,
  total,
  onOrderComplete,
  canProcessPayment = true,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [savedOrderNumber, setSavedOrderNumber] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [isAutoPrinting, setIsAutoPrinting] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [allowManualNameInput, setAllowManualNameInput] = useState(false);

  const printer = useBluetootPrinter();
  const printApp = useBluetoothPrintApp();
  const quickNames = ["Barra", "Para llevar"];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    setIsTouchDevice(isCoarsePointer);
    if (isCoarsePointer) {
      setAllowManualNameInput(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncWhenOnline = async () => {
      const result = await syncPendingOfflineOrders();
      if (result.synced > 0) {
        toast.success(`Se sincronizaron ${result.synced} pedidos pendientes`);
      }
      if (result.failed > 0) {
        toast.warning(
          `${result.failed} pedido(s) pendientes no pudieron sincronizarse por un error de datos.`
        );
      }
    };

    void syncWhenOnline();
    window.addEventListener("online", syncWhenOnline);
    return () => window.removeEventListener("online", syncWhenOnline);
  }, []);

  const blurActiveElement = () => {
    if (typeof document === "undefined") return;
    const active = document.activeElement as HTMLElement | null;
    active?.blur();
  };

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;

    if (typeof error === "object" && error !== null) {
      const record = error as Record<string, unknown>;
      if (typeof record.message === "string" && record.message.trim()) return record.message;
      if (typeof record.error_description === "string" && record.error_description.trim()) {
        return record.error_description;
      }
      if (typeof record.details === "string" && record.details.trim()) return record.details;
    }

    return "Error desconocido";
  };

  const isNetworkError = (error: unknown) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return true;
    const msg = getErrorMessage(error).toLowerCase();
    return msg.includes("fetch") || msg.includes("network") || msg.includes("failed to fetch");
  };

  const buildOfflinePayload = (normalizedCustomerName: string): Omit<OfflineOrderPayload, "localId" | "localOrderNumber" | "createdAt"> => ({
    customerName: normalizedCustomerName,
    total,
    paymentMethod,
    items: items.map((item) => ({
      productId: item.product.id,
      productSizeId: item.productSize?.id || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      customLabel: item.customLabel || null,
      customizationIngredientIds: (item.customizations || []).map((c) => c.ingredient.id),
    })),
  });

  const printWithWebFallback = async (
    type: "cliente" | "cocina",
    orderNumber: number | null,
    orderCustomerName: string
  ) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (type === "cliente") {
      await printer.printClientTicket(
        items,
        total,
        orderNumber,
        orderCustomerName,
        dateStr,
        getPaymentMethodLabel(paymentMethod)
      );
      return;
    }

    await printer.printKitchenOrder(items, orderNumber, orderCustomerName, dateStr);
  };

  const handlePay = async () => {
    if (!canProcessPayment) {
      toast.error("Caja cerrada. Registra apertura de caja para continuar.");
      return;
    }

    const normalizedCustomerName = customerName.trim() || "Barra";
    blurActiveElement();

    setSaving(true);
    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({ total, status: "pagado", customer_name: normalizedCustomerName })
        .select()
        .single();
      if (orderError) throw orderError;

      // Create order items
      for (const item of items) {
        const { data: orderItem, error: itemError } = await supabase
          .from("order_items")
          .insert({
            order_id: order.id,
            product_id: item.product.id,
            product_size_id: item.productSize?.id || null,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            subtotal: item.subtotal,
            custom_label: item.customLabel || null,
          })
          .select()
          .single();
        if (itemError) throw itemError;

        // Insert customizations
        if (item.customizations && item.customizations.length > 0) {
          const customRows = item.customizations.map((c) => ({
            order_item_id: orderItem.id,
            ingredient_id: c.ingredient.id,
          }));
          const { error: custError } = await supabase
            .from("order_item_customizations")
            .insert(customRows);
          if (custError) throw custError;
        }
      }

      setSavedOrderNumber(order.order_number);
      registerPaidSale({
        orderId: order.id,
        orderNumber: order.order_number,
        customerName: normalizedCustomerName,
        total,
        paymentMethod,
        createdAt: order.created_at,
      });
      toast.success(`Pedido #${order.order_number} guardado`);

      // Auto-print if enabled (single ticket)
      if (printer.preferences.autoPrint) {
        setIsAutoPrinting(true);
        try {
          let printed = false;
          if (printApp.isBluetoothPrintAppAvailable()) {
            printed = await printApp.printClientTicket(
              items,
              total,
              order.order_number,
              normalizedCustomerName
            );
          }
          if (!printed) {
            await printWithWebFallback("cliente", order.order_number, normalizedCustomerName);
          }
        } catch (err) {
          console.error("Error en impresión automática:", err);
          toast.warning("No se pudo imprimir automáticamente");
        } finally {
          setIsAutoPrinting(false);
        }
      }
    } catch (err: unknown) {
      if (isNetworkError(err)) {
        const offlineOrder = enqueueOfflineOrder(buildOfflinePayload(normalizedCustomerName));
        setSavedOrderNumber(offlineOrder.localOrderNumber);
        setCustomerName(normalizedCustomerName);
        registerPaidSale({
          orderId: offlineOrder.localId,
          orderNumber: offlineOrder.localOrderNumber,
          customerName: normalizedCustomerName,
          total,
          paymentMethod,
          createdAt: offlineOrder.createdAt,
        });
        toast.warning(
          `Sin internet: pedido #${offlineOrder.localOrderNumber} guardado localmente y pendiente de sincronizar`
        );
        return;
      }
      toast.error("Error al guardar: " + getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const printTicket = async (type: "cliente" | "cocina") => {
    setIsAutoPrinting(true);
    try {
      if (type === "cliente" && printApp.isBluetoothPrintAppAvailable()) {
        const printed = await printApp.printClientTicket(
          items,
          total,
          savedOrderNumber,
          customerName
        );
        if (printed) return;
      }
      await printWithWebFallback(type, savedOrderNumber, customerName);
    } catch (err) {
      console.error("Error al imprimir:", err);
      toast.error("Error al imprimir");
    } finally {
      setIsAutoPrinting(false);
    }
  };

  const handleClose = () => {
    if (savedOrderNumber) {
      onOrderComplete();
    }
    setSavedOrderNumber(null);
    setCustomerName("");
    setPaymentMethod("efectivo");
    setAllowManualNameInput(false);
    blurActiveElement();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {savedOrderNumber ? `Pedido #${savedOrderNumber}` : "Resumen del Pedido"}
          </DialogTitle>
          <DialogDescription>
            Revisa la orden, confirma el pago y luego imprime ticket de cliente o comanda.
          </DialogDescription>
        </DialogHeader>

        {!savedOrderNumber && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="customer-name" className="text-sm font-medium text-foreground">
                Nombre de la orden *
              </label>
              <Input
                id="customer-name"
                placeholder="¿A nombre de quién es la orden?"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                onFocus={() => {
                  if (isTouchDevice && !allowManualNameInput) {
                    blurActiveElement();
                  }
                }}
                readOnly={isTouchDevice && !allowManualNameInput}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="words"
                enterKeyHint="done"
              />
              <div className="flex flex-wrap gap-2">
                {quickNames.map((label) => (
                  <Button
                    key={label}
                    type="button"
                    variant={customerName === label ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setCustomerName(label);
                      blurActiveElement();
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {isTouchDevice && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAllowManualNameInput((prev) => !prev);
                    blurActiveElement();
                  }}
                >
                  {allowManualNameInput ? "Ocultar teclado" : "Escribir nombre manual"}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Método de pago</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === "efectivo" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("efectivo")}
                >
                  Efectivo
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "tarjeta" ? "default" : "outline"}
                  onClick={() => setPaymentMethod("tarjeta")}
                >
                  Tarjeta
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2 text-sm max-h-[50vh] overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span className="text-foreground">
                {item.quantity}x {getDisplayProductName(item.product.name)}
                {item.productSize && ` (${item.productSize.name})`}
              </span>
              <span className="font-medium text-foreground">{formatCurrencyMXN(item.subtotal, 0)}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between text-lg font-bold">
            <span className="text-foreground">Total</span>
            <span className="text-primary">{formatCurrencyMXN(total, 0)}</span>
          </div>
        </div>

        {!savedOrderNumber ? (
          <Button onClick={handlePay} disabled={saving} className="w-full">
            {saving ? "Guardando..." : "Confirmar Pago"}
          </Button>
        ) : (
          <div className="space-y-3">
            {isAutoPrinting && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-blue-50 p-2 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Imprimiendo...
              </div>
            )}
            <div className="flex">
              <Button
                variant="outline"
                className="flex-1 gap-1"
                onClick={() => printTicket("cliente")}
                disabled={isAutoPrinting}
              >
                <Printer className="h-4 w-4" /> Ticket
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
