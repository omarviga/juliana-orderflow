import { cn } from "@/lib/utils";
import type { Category } from "@/types/pos";
import { Salad, Sandwich, Coffee, CookingPot, Leaf } from "lucide-react";

const categoryIcons: Record<string, React.ElementType> = {
  "Ensaladas de la Casa": Salad,
  "Arma tu Ensalada": Leaf,
  "Sándwiches": Sandwich,
  "Toasts": CookingPot,
  "Bebidas": Coffee,
};

interface Props {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CategoryList({ categories, selectedId, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Categorías
      </h2>
      {categories.map((cat) => {
        const Icon = categoryIcons[cat.name] || Salad;
        const isActive = selectedId === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card text-foreground hover:bg-accent"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}
