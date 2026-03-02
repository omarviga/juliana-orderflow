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
import { Printer, Loader2, Bluetooth } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useBluetootPrinter } from "@/hooks/useBluetootPrinter";
import {
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
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [isAutoPrinting, setIsAutoPrinting] = useState(false);
  const [isLinkingPrinter, setIsLinkingPrinter] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [allowManualNameInput, setAllowManualNameInput] = useState(false);
  const printer = useBluetootPrinter();
  const quickNames = ["Barra", "Para llevar"];

  const parseCashAmount = (value: string): number => {
    const normalized = value.replace(/[^0-9.]/g, "");
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const cashReceived = parseCashAmount(cashReceivedInput);
  const change = paymentMethod === "efectivo" ? Math.max(0, cashReceived - total) : 0;
  const isCashInsufficient = paymentMethod === "efectivo" && cashReceived > 0 && cashReceived < total;
  const isCashMissing = paymentMethod === "efectivo" && cashReceived <= 0;

  const paymentMethodLabelForTicket = () => {
    if (paymentMethod !== "efectivo") {
      return getPaymentMethodLabel(paymentMethod);
    }
    if (cashReceived <= 0) {
      return "Efectivo";
    }
    return `Efectivo (${formatCurrencyMXN(cashReceived, 0)} / Cambio ${formatCurrencyMXN(change, 0)})`;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const touchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints > 0 : false;
    const touchApi = "ontouchstart" in window;
    const touchDevice = coarsePointer || touchPoints || touchApi;
    setIsTouchDevice(touchDevice);
    if (touchDevice) {
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

  const printCombinedTickets = async (orderNumber: number | null, orderCustomerName: string) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    await printer.printKitchenAndClientCombined(
      items,
      total,
      orderNumber,
      orderCustomerName,
      dateStr,
      paymentMethodLabelForTicket()
    );
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
      kitchenNote: item.kitchenNote || null,
      customizationIngredientIds: (item.customizations || []).map((c) => c.ingredient.id),
    })),
  });

  const handlePay = async () => {
    if (!canProcessPayment) {
      toast.error("Caja cerrada. Registra apertura de caja para continuar.");
      return;
    }

    const normalizedCustomerName = customerName.trim() || "Barra";
    if (paymentMethod === "efectivo") {
      if (isCashMissing) {
        toast.error("Captura cuánto pagó el cliente en efectivo.");
        return;
      }
      if (cashReceived < total) {
        toast.error("El monto recibido es menor al total.");
        return;
      }
    }
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
            kitchen_note: item.kitchenNote || null,
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

      // Auto-print kitchen + client in one job.
      if (printer.preferences.autoPrint) {
        setIsAutoPrinting(true);
        try {
          await printCombinedTickets(order.order_number, normalizedCustomerName);
        } catch (err) {
          console.error("Error en impresión automática:", err);
          toast.warning(`No se pudo imprimir automáticamente: ${getErrorMessage(err)}`);
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

  const printTicket = async () => {
    setIsAutoPrinting(true);
    try {
      await printCombinedTickets(savedOrderNumber, customerName);
    } catch (err) {
      console.error("Error al imprimir:", err);
      toast.error(`Error al imprimir: ${getErrorMessage(err)}`);
    } finally {
      setIsAutoPrinting(false);
    }
  };

  const selectedPrinter = printer.getClientPrinter();

  const handleLinkPrinter = async () => {
    setIsLinkingPrinter(true);
    try {
      const linkedPrinter = await printer.selectClientPrinter();
      toast.success(`Impresora vinculada: ${linkedPrinter.name}`);
    } catch (error) {
      toast.error(`No se pudo vincular la impresora: ${getErrorMessage(error)}`);
    } finally {
      setIsLinkingPrinter(false);
    }
  };

  const handleClose = () => {
    if (savedOrderNumber) {
      onOrderComplete();
    }
    setSavedOrderNumber(null);
    setCustomerName("");
    setPaymentMethod("efectivo");
    setCashReceivedInput("");
    // En touch debe permanecer habilitado al reabrir el modal.
    setAllowManualNameInput(isTouchDevice);
    blurActiveElement();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

            {paymentMethod === "efectivo" && (
              <div className="space-y-2 rounded-md border p-3">
                <label htmlFor="cash-received" className="text-sm font-medium text-foreground">
                  Paga con
                </label>
                <Input
                  id="cash-received"
                  inputMode="decimal"
                  placeholder="Monto recibido"
                  value={cashReceivedInput}
                  onChange={(event) => setCashReceivedInput(event.target.value)}
                />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cambio</span>
                  <span className="font-semibold text-primary">{formatCurrencyMXN(change, 0)}</span>
                </div>
                {isCashInsufficient && (
                  <p className="text-xs text-destructive">
                    El monto no alcanza para cubrir el total.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 text-sm max-h-[30vh] overflow-y-auto sm:max-h-[38vh]">
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
          <div className="space-y-3">
            <div className="rounded-md border p-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between gap-2">
                <span>
                  Impresora actual:{" "}
                  <span className="font-medium text-foreground">
                    {selectedPrinter?.name || "Sin vincular"}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={handleLinkPrinter}
                  disabled={isLinkingPrinter}
                >
                  {isLinkingPrinter ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bluetooth className="h-4 w-4" />
                  )}
                  Vincular
                </Button>
              </div>
            </div>
            <Button
              onClick={handlePay}
              disabled={saving || (paymentMethod === "efectivo" && (isCashMissing || cashReceived < total))}
              className="w-full"
            >
              {saving ? "Guardando..." : "Confirmar Pago"}
            </Button>
          </div>
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
                onClick={printTicket}
                disabled={isAutoPrinting}
              >
                <Printer className="h-4 w-4" /> Cocina + Ticket
              </Button>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-1"
              onClick={handleLinkPrinter}
              disabled={isLinkingPrinter}
            >
              {isLinkingPrinter ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bluetooth className="h-4 w-4" />
              )}
              {selectedPrinter ? `Re-vincular (${selectedPrinter.name})` : "Vincular impresora"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
