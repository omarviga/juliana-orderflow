import { useRef, useState } from "react";
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
import { Printer } from "lucide-react";

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
  const ticketRef = useRef<HTMLDivElement>(null);
  const comandaRef = useRef<HTMLDivElement>(null);

  const handlePay = async () => {
    setSaving(true);
    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({ total, status: "pagado" })
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
    } catch (err: any) {
      toast.error("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const printTicket = (type: "cliente" | "cocina") => {
    const printContent = type === "cliente" ? ticketRef.current : comandaRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const className = type === "cliente" ? "print-ticket-cliente" : "print-comanda-cocina";
    printWindow.document.write(`
      <html>
        <head>
          <title>${type === "cliente" ? "Ticket Cliente" : "Comanda Cocina"}</title>
          <style>
            body { margin: 0; padding: 0; font-family: 'Courier New', monospace; }
            .${className} { visibility: visible !important; position: static !important; }
            ${type === "cocina" ? `
              .item-nombre { font-size: 1.4rem; font-weight: bold; border-bottom: 1px dashed #000; margin-bottom: 4px; text-transform: uppercase; }
              .ingrediente-lista { font-size: 1.1rem; padding-left: 5px; text-transform: uppercase; }
            ` : `
              .header-logo { text-align: center; font-weight: bold; font-size: 1.3rem; margin-bottom: 8px; }
              .total-row { font-size: 1.2rem; font-weight: bold; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }
            `}
            .line { border-top: 1px dashed #000; margin: 6px 0; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .flex-between { display: flex; justify-content: space-between; }
            .mb-1 { margin-bottom: 4px; }
            .mb-2 { margin-bottom: 8px; }
            .mt-2 { margin-top: 8px; }
            ${type === "cliente" ? "body { width: 80mm; padding: 3mm; font-size: 11pt; }" : "body { width: 58mm; padding: 2mm; font-size: 13pt; }"}
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleClose = () => {
    if (savedOrderNumber) {
      onOrderComplete();
    }
    setSavedOrderNumber(null);
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-1"
              onClick={() => printTicket("cliente")}
            >
              <Printer className="h-4 w-4" /> Ticket Cliente
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-1"
              onClick={() => printTicket("cocina")}
            >
              <Printer className="h-4 w-4" /> Comanda Cocina
            </Button>
          </div>
        )}

        {/* Hidden print templates */}
        <div className="hidden">
          <div ref={ticketRef} className="print-ticket-cliente">
            <div className="header-logo">JULIANA</div>
            <div className="text-center mb-1" style={{ fontSize: "0.8rem" }}>
              BARRA COTIDIANA
            </div>
            <div className="text-center mb-1" style={{ fontSize: "0.7rem" }}>
              Av. Miguel Hidalgo #276
            </div>
            <div className="text-center mb-2" style={{ fontSize: "0.7rem" }}>
              Tel: 417 206 0111
            </div>
            <div className="line" />
            <div className="mb-1">
              Pedido: #{savedOrderNumber || "---"}
            </div>
            <div className="mb-1">{dateStr}</div>
            <div className="line" />
            {items.map((item) => (
              <div key={item.id} className="mb-1">
                <div className="flex-between">
                  <span>
                    {item.quantity}x {item.product.name}
                    {item.productSize && ` (${item.productSize.name})`}
                  </span>
                  <span className="text-right">${item.subtotal.toFixed(0)}</span>
                </div>
                {item.customLabel && (
                  <div style={{ fontSize: "0.7rem", paddingLeft: "8px" }}>
                    {item.customLabel}
                  </div>
                )}
              </div>
            ))}
            <div className="total-row flex-between mt-2">
              <span>TOTAL</span>
              <span>${total.toFixed(0)}</span>
            </div>
            <div className="line" />
            <div className="text-center mt-2" style={{ fontSize: "0.8rem" }}>
              ¡Gracias por tu visita!
            </div>
          </div>

          <div ref={comandaRef} className="print-comanda-cocina">
            <div style={{ fontWeight: "bold", fontSize: "1.3rem", textAlign: "center" }}>
              COMANDA #{savedOrderNumber || "---"}
            </div>
            <div className="line" />
            {items.map((item) => (
              <div key={item.id} className="mb-2">
                <div className="item-nombre">
                  {item.quantity}x {item.product.name}
                  {item.productSize && ` (${item.productSize.name})`}
                </div>
                {item.customizations && item.customizations.length > 0 && (
                  <div className="ingrediente-lista">
                    {item.customizations.map((c) => (
                      <div key={c.ingredient.id}>• {c.ingredient.name}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
