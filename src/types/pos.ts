import type { Tables } from "@/integrations/supabase/types";

export type Category = Tables<"categories">;
export type Product = Tables<"products">;
export type ProductSize = Tables<"product_sizes">;
export type Ingredient = Tables<"ingredients">;

export interface CartItem {
  id: string; // unique cart item id
  product: Product;
  productSize?: ProductSize;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  customizations?: SelectedIngredient[];
  customLabel?: string;
}

export interface SelectedIngredient {
  ingredient: Ingredient;
  extraCost: number;
}

export interface SaladConfig {
  size: "Mediana" | "Grande";
  basePrice: number;
  proteinLimit: number;
  toppingLimit: number;
}

export const SALAD_CONFIGS: Record<string, SaladConfig> = {
  Mediana: { size: "Mediana", basePrice: 110, proteinLimit: 2, toppingLimit: 5 },
  Grande: { size: "Grande", basePrice: 125, proteinLimit: 3, toppingLimit: 6 },
};
