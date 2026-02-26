import { useMemo, useState } from "react";
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
import {
  isAllowedSaladProtein,
  isAllowedSaladTopping,
  isPremiumProteinIngredient,
  isPremiumToppingIngredient,
} from "@/lib/salad-rules";
import { Check } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  product: Product;
  productSize?: ProductSize;
  title?: string;
  requireAtLeastOneSelection?: boolean;
  ingredients: Ingredient[];
  onAddToCart: (
    product: Product,
    unitPrice: number,
    customizations: SelectedIngredient[],
    label: string,
    productSize?: ProductSize
  ) => void;
}

const EXTRA_PRICES = {
  topping: 10,
  toppingPremium: 15,
  crocante: 10,
  proteina: 20,
  proteinaPremium: 25,
  aderezo: 15,
};

export function HouseSaladExtrasModal({
  open,
  onClose,
  product,
  productSize,
  title,
  requireAtLeastOneSelection = false,
  ingredients,
  onAddToCart,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const saladToppings = ingredients.filter(isAllowedSaladTopping);
  const toppings = saladToppings.filter((i) => !isPremiumToppingIngredient(i));
  const premiumToppings = saladToppings.filter((i) => isPremiumToppingIngredient(i));
  const crocantes = ingredients.filter((i) => i.type === "crocante");
  const saladProteins = ingredients.filter(isAllowedSaladProtein);
  const proteins = saladProteins.filter((i) => !isPremiumProteinIngredient(i));
  const premiumProteins = saladProteins.filter((i) => isPremiumProteinIngredient(i));
  const dressings = ingredients.filter((i) => i.type === "aderezo");

  const selectedIngredients = useMemo(
    () => ingredients.filter((i) => selectedIds.includes(i.id)),
    [ingredients, selectedIds]
  );

  const total = useMemo(() => {
    return selectedIngredients.reduce((sum, ingredient) => {
      if (ingredient.type === "topping") {
        return sum + (isPremiumToppingIngredient(ingredient) ? EXTRA_PRICES.toppingPremium : EXTRA_PRICES.topping);
      }
      if (ingredient.type === "crocante") return sum + EXTRA_PRICES.crocante;
      if (ingredient.type === "aderezo") return sum + EXTRA_PRICES.aderezo;
      if (ingredient.type === "proteina") {
        return sum + (isPremiumProteinIngredient(ingredient) ? EXTRA_PRICES.proteinaPremium : EXTRA_PRICES.proteina);
      }
      return sum;
    }, product.price || 0);
  }, [product.price, selectedIngredients]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const reset = () => {
    setSelectedIds([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAddToCart = () => {
    if (requireAtLeastOneSelection && selectedIngredients.length === 0) return;

    const customizations: SelectedIngredient[] = selectedIngredients.map((ingredient) => {
      let extraCost = 0;

      if (ingredient.type === "topping") {
        extraCost = isPremiumToppingIngredient(ingredient) ? EXTRA_PRICES.toppingPremium : EXTRA_PRICES.topping;
      }
      if (ingredient.type === "crocante") extraCost = EXTRA_PRICES.crocante;
      if (ingredient.type === "aderezo") extraCost = EXTRA_PRICES.aderezo;
      if (ingredient.type === "proteina") {
        extraCost = isPremiumProteinIngredient(ingredient) ? EXTRA_PRICES.proteinaPremium : EXTRA_PRICES.proteina;
      }

      return { ingredient, extraCost };
    });

    const label =
      selectedIngredients.length > 0
        ? `${
            requireAtLeastOneSelection ? "Añadido de más" : "Extras"
          }: ${selectedIngredients.map((item) => item.name).join(", ")}`
        : "Sin extras";

    onAddToCart(product, total, customizations, label, productSize);
    handleClose();
  };

  const ingredientGroups = [
    { title: "Toppings (+$10)", items: toppings },
    { title: "Topping Premium (+$15)", items: premiumToppings },
    { title: "Crocantes (+$10)", items: crocantes },
    { title: "Proteína (+$20)", items: proteins },
    { title: "Proteína Premium (+$25)", items: premiumProteins },
    { title: "Aderezo / Vinagreta (+$15)", items: dressings },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">{title || `Extras para ${product.name}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {ingredientGroups.map((group) => (
            <div key={group.title}>
              <h4 className="mb-2 text-sm font-semibold text-foreground">{group.title}</h4>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((ingredient) => {
                  const isSelected = selectedIds.includes(ingredient.id);

                  return (
                    <button
                      key={ingredient.id}
                      onClick={() => toggleSelection(ingredient.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors",
                        isSelected ? "border-primary bg-accent" : "border-border hover:bg-muted"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-md border shrink-0",
                          isSelected ? "bg-primary border-primary" : "border-border"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className="text-foreground truncate">{ingredient.name}</span>
                    </button>
                  );
                })}
                {group.items.length === 0 && (
                  <p className="text-xs text-muted-foreground col-span-2">
                    No hay opciones disponibles.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-lg font-bold text-primary">Total: ${total.toFixed(0)}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleAddToCart} disabled={requireAtLeastOneSelection && selectedIngredients.length === 0}>
            Agregar al carrito
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
