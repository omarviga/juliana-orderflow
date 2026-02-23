import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CartItem } from "@/types/pos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Printer, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useBluetootPrinter } from "@/hooks/useBluetootPrinter";

interface Props {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
  onOrderComplete: () => void;
}

export function PaymentModal({ open, onClose, items, total, onOrderComplete }: Props) {
  const [saving, setSaving] = useState(false);
  const [savedOrderNumber, setSavedOrderNumber] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [isAutoPrinting, setIsAutoPrinting] = useState(false);

  const printer = useBluetootPrinter();

  const handlePay = async () => {
    if (!customerName.trim()) {
      toast.error("Debes ingresar el nombre de la orden");
      return;
    }

    setSaving(true);
    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({ total, status: "pagado", customer_name: customerName.trim() })
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
      toast.success(`Pedido #${order.order_number} guardado`);

      // Auto-print if enabled
      if (printer.preferences.autoPrint) {
        setIsAutoPrinting(true);
        const now = new Date();
        const dateStr = now.toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        // Print both: kitchen order first, then client ticket
        try {
          await printer.printKitchenOrder(
            items,
            order.order_number,
            customerName.trim(),
            dateStr
          );
          await printer.printClientTicket(
            items,
            total,
            order.order_number,
            customerName.trim(),
            dateStr
          );
        } catch (err) {
          console.error("Error en impresión automática:", err);
          // Don't show error toast, just continue
        } finally {
          setIsAutoPrinting(false);
        }
      }
    } catch (err: any) {
      toast.error("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const printTicket = async (type: "cliente" | "cocina") => {
    setIsAutoPrinting(true);
    try {
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
          savedOrderNumber,
          customerName,
          dateStr
        );
      } else {
        await printer.printKitchenOrder(
          items,
          savedOrderNumber,
          customerName,
          dateStr
        );
      }
    } catch (err) {
      console.error("Error al imprimir:", err);
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
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {savedOrderNumber ? `Pedido #${savedOrderNumber}` : "Resumen del Pedido"}
          </DialogTitle>
        </DialogHeader>

        {!savedOrderNumber && (
          <div className="space-y-2">
            <label htmlFor="customer-name" className="text-sm font-medium text-foreground">
              Nombre de la orden *
            </label>
            <Input
              id="customer-name"
              placeholder="¿A nombre de quién es la orden?"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
            />
          </div>
        )}

        <div className="space-y-2 text-sm max-h-[50vh] overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span className="text-foreground">
                {item.quantity}x {item.product.name}
                {item.productSize && ` (${item.productSize.name})`}
              </span>
              <span className="font-medium text-foreground">${item.subtotal.toFixed(0)}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between text-lg font-bold">
            <span className="text-foreground">Total</span>
            <span className="text-primary">${total.toFixed(0)}</span>
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-1"
                onClick={() => printTicket("cliente")}
                disabled={isAutoPrinting}
              >
                <Printer className="h-4 w-4" /> Ticket Cliente
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-1"
                onClick={() => printTicket("cocina")}
                disabled={isAutoPrinting}
              >
                <Printer className="h-4 w-4" /> Comanda Cocina
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
