import { Trash2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CartItem } from "@/types/pos";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NumPad } from "./NumPad";
import { useState } from "react";
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

const getDisplayProductName = (name: string) => {
  const normalized = normalizeText(name);
  if (STANDALONE_EXTRA_PRODUCT_NAMES.has(normalized)) return "Extra";
  return name;
};

interface Props {
  items: CartItem[];
  total: number;
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateKitchenNote: (id: string, note: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onPay: () => void;
  payDisabled?: boolean;
  onAddStandaloneExtra?: () => void;
  standaloneExtraDisabled?: boolean;
}

export function CartPanel({
  items,
  total,
  onUpdateQuantity,
  onUpdateKitchenNote,
  onRemove,
  onClear,
  onPay,
  payDisabled = false,
  onAddStandaloneExtra,
  standaloneExtraDisabled = false,
}: Props) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const handleNumPadInput = (value: number) => {
    if (selectedItemId && value > 0) {
      onUpdateQuantity(selectedItemId, value);
    }
  };

  const handleKitchenNote = (id: string, currentNote?: string) => {
    const note = window.prompt(
      "Nota para cocina (deja vacio para eliminarla):",
      currentNote || ""
    );
    if (note === null) return;
    onUpdateKitchenNote(id, note);
  };

  return (
    <div className="flex h-full flex-col border-l bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pedido actual
        </h2>
      </div>

      <ScrollArea className="flex-1 px-3">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin productos
          </p>
        ) : (
          <div className="space-y-2 py-2">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className={`rounded-lg border p-2.5 text-sm transition-colors cursor-pointer ${
                  selectedItemId === item.id
                    ? "border-primary bg-accent"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {getDisplayProductName(item.product.name)}
                      {item.productSize && (
                        <span className="ml-1 text-muted-foreground">
                          ({item.productSize.name})
                        </span>
                      )}
                    </p>
                    {item.customLabel && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {item.customLabel}
                      </p>
                    )}
                    {item.kitchenNote && (
                      <p className="mt-0.5 text-xs font-medium text-foreground">
                        Nota cocina: {item.kitchenNote}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                    }}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleKitchenNote(item.id, item.kitchenNote);
                      }}
                      className="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-accent"
                    >
                      Nota
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity(item.id, item.quantity - 1);
                      }}
                      className="rounded border border-border p-0.5 hover:bg-accent"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-medium">{item.quantity}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateQuantity(item.id, item.quantity + 1);
                      }}
                      className="rounded border border-border p-0.5 hover:bg-accent"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="font-semibold text-foreground">
                    {formatCurrencyMXN(item.subtotal, 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <NumPad onSubmit={handleNumPadInput} />

      <div className="border-t p-3 space-y-2">
        {onAddStandaloneExtra && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={onAddStandaloneExtra}
            disabled={standaloneExtraDisabled}
          >
            Agregar extra
          </Button>
        )}
        <div className="flex items-center justify-between text-lg font-bold">
          <span className="text-foreground">Total</span>
          <span className="text-primary">{formatCurrencyMXN(total, 0)}</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClear}
            disabled={items.length === 0}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={onPay}
            disabled={items.length === 0 || payDisabled}
          >
            Pagar
          </Button>
        </div>
      </div>
    </div>
  );
}
