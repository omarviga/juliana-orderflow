import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Ingredient, Product, ProductSize, SelectedIngredient } from "@/types/pos";
import { SALAD_CONFIGS } from "@/types/pos";
import { Check } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  product: Product;
  sizes: ProductSize[];
  ingredients: Ingredient[];
  onAddToCart: (
    product: Product,
    unitPrice: number,
    size: ProductSize,
    customizations: SelectedIngredient[],
    label: string
  ) => void;
}

export function CustomSaladModal({
  open,
  onClose,
  product,
  sizes,
  ingredients,
  onAddToCart,
}: Props) {
  const [step, setStep] = useState(0);
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(null);
  const [selectedProteins, setSelectedProteins] = useState<string[]>([]);
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [selectedCrocante, setSelectedCrocante] = useState<string | null>(null);
  const [selectedAderezos, setSelectedAderezos] = useState<string[]>([]);

  const selectedSize = sizes.find((s) => s.id === selectedSizeId);
  const config = selectedSize ? SALAD_CONFIGS[selectedSize.name] : null;

  const proteins = ingredients.filter((i) => i.type === "proteina");
  const toppings = ingredients.filter((i) => i.type === "topping");
  const crocantes = ingredients.filter((i) => i.type === "crocante");
  const aderezos = ingredients.filter((i) => i.type === "aderezo");

  const calculatedPrice = useMemo(() => {
    if (!config) return 0;
    let price = config.basePrice;

    // Proteins
    const selProteins = proteins.filter((p) => selectedProteins.includes(p.id));
    let included = 0;
    for (const p of selProteins) {
      if (included < config.proteinLimit) {
        included++;
        if (p.is_premium) price += 25; // premium always costs $25
      } else {
        price += p.is_premium ? 25 : 20; // extras
      }
    }

    // Toppings
    const selToppings = toppings.filter((t) => selectedToppings.includes(t.id));
    let tIncluded = 0;
    for (const t of selToppings) {
      if (tIncluded < config.toppingLimit) {
        tIncluded++;
        if (t.is_premium) price += 15; // premium always costs $15
      } else {
        price += t.is_premium ? 15 : 10; // extras
      }
    }

    // Aderezos: first included, rest $15
    if (selectedAderezos.length > 1) {
      price += (selectedAderezos.length - 1) * 15;
    }

    return price;
  }, [config, selectedProteins, selectedToppings, selectedAderezos, proteins, toppings]);

  const reset = () => {
    setStep(0);
    setSelectedSizeId(null);
    setSelectedProteins([]);
    setSelectedToppings([]);
    setSelectedCrocante(null);
    setSelectedAderezos([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleSelection = (
    id: string,
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAddToCart = () => {
    if (!selectedSize || !config) return;

    const allSelected: SelectedIngredient[] = [];
    const buildLabel: string[] = [config.size];

    const selP = proteins.filter((p) => selectedProteins.includes(p.id));
    let pIncluded = 0;
    for (const p of selP) {
      let cost = 0;
      if (pIncluded < config.proteinLimit) {
        pIncluded++;
        if (p.is_premium) cost = 25;
      } else {
        cost = p.is_premium ? 25 : 20;
      }
      allSelected.push({ ingredient: p, extraCost: cost });
      buildLabel.push(p.name);
    }

    const selT = toppings.filter((t) => selectedToppings.includes(t.id));
    let tInc = 0;
    for (const t of selT) {
      let cost = 0;
      if (tInc < config.toppingLimit) {
        tInc++;
        if (t.is_premium) cost = 15;
      } else {
        cost = t.is_premium ? 15 : 10;
      }
      allSelected.push({ ingredient: t, extraCost: cost });
    }

    if (selectedCrocante) {
      const c = crocantes.find((x) => x.id === selectedCrocante)!;
      allSelected.push({ ingredient: c, extraCost: 0 });
      buildLabel.push(c.name);
    }

    selectedAderezos.forEach((aId, i) => {
      const a = aderezos.find((x) => x.id === aId)!;
      allSelected.push({ ingredient: a, extraCost: i === 0 ? 0 : 15 });
    });

    const label = buildLabel.join(", ");
    onAddToCart(product, calculatedPrice, selectedSize, allSelected, label);
    handleClose();
  };

  const steps = ["Tamaño", "Proteínas", "Toppings", "Crocante y Aderezo"];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Arma tu Ensalada</DialogTitle>
          <div className="flex gap-1 mt-2">
            {steps.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "flex-1 rounded-full h-1.5 transition-colors",
                  i <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Paso {step + 1}: {steps[step]}
          </p>
        </DialogHeader>

        <div className="min-h-[200px]">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-3">
              {sizes.map((size) => (
                <button
                  key={size.id}
                  onClick={() => setSelectedSizeId(size.id)}
                  className={cn(
                    "rounded-lg border-2 p-4 text-center transition-colors",
                    selectedSizeId === size.id
                      ? "border-primary bg-accent"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <p className="text-lg font-bold text-foreground">{size.name}</p>
                  <p className="text-xl font-bold text-primary">${size.price.toFixed(0)}</p>
                </button>
              ))}
            </div>
          )}

          {step === 1 && config && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                Incluidas: {config.proteinLimit} | Premium (+$25) | Extra: $20/$25
              </p>
              <div className="grid grid-cols-2 gap-2">
                {proteins.map((p) => {
                  const sel = selectedProteins.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleSelection(p.id, selectedProteins, setSelectedProteins)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                        sel ? "border-primary bg-accent" : "border-border hover:bg-muted"
                      )}
                    >
                      <div className={cn("flex h-5 w-5 items-center justify-center rounded-md border", sel ? "bg-primary border-primary" : "border-border")}>
                        {sel && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-foreground">{p.name}</span>
                      {p.is_premium && (
                        <span className="ml-auto text-xs font-medium text-warning">★</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && config && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                Incluidos: {config.toppingLimit} | Premium ($15) | Extra: $10/$15
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                {toppings.map((t) => {
                  const sel = selectedToppings.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleSelection(t.id, selectedToppings, setSelectedToppings)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors",
                        sel ? "border-primary bg-accent" : "border-border hover:bg-muted"
                      )}
                    >
                      <div className={cn("flex h-5 w-5 items-center justify-center rounded-md border shrink-0", sel ? "bg-primary border-primary" : "border-border")}>
                        {sel && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-foreground truncate">{t.name}</span>
                      {t.is_premium && (
                        <span className="ml-auto text-xs font-medium text-warning shrink-0">★</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  Crocante (1 incluido)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {crocantes.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCrocante(c.id === selectedCrocante ? null : c.id)}
                      className={cn(
                        "rounded-lg border p-2.5 text-center text-sm transition-colors",
                        selectedCrocante === c.id
                          ? "border-primary bg-accent"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <span className="text-foreground">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  Aderezos (1 incluido, extras $15 c/u)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {aderezos.map((a) => {
                    const sel = selectedAderezos.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleSelection(a.id, selectedAderezos, setSelectedAderezos)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors",
                          sel ? "border-primary bg-accent" : "border-border hover:bg-muted"
                        )}
                      >
                        <div className={cn("flex h-5 w-5 items-center justify-center rounded-md border shrink-0", sel ? "bg-primary border-primary" : "border-border")}>
                          {sel && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <span className="text-foreground truncate">{a.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-lg font-bold text-primary">
            Total: ${calculatedPrice.toFixed(0)}
          </p>
        </div>

        <DialogFooter className="gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Anterior
            </Button>
          )}
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 0 && !selectedSizeId}
            >
              Siguiente
            </Button>
          ) : (
            <Button onClick={handleAddToCart} disabled={!selectedSizeId}>
              Agregar al carrito
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
