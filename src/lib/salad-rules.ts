import type { Ingredient } from "@/types/pos";

const normalizeName = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const REGULAR_PROTEIN_NAMES = [
  "POLLO",
  "POLLO DEL DIA",
  "HUEVO COCIDO",
  "QUESO PANELA",
  "ATUN",
];

const PREMIUM_PROTEIN_NAMES = [
  "SALMON",
  "JAMON SERRANO",
  "ROAST BEEF",
];

const REGULAR_TOPPING_NAMES = [
  "ESPINACA",
  "ZANAHORIA",
  "CHAMPINON",
  "ACEITUNA NEGRA",
  "JITOMATE CHERRY",
  "BROCOLI",
  "PASTA FUSSILI",
  "PEPINO PERSA",
  "PIMIENTOS",
  "PINA EN ALMIBAR",
  "ELOTE",
  "FRESA",
  "APIO",
  "CEBOLLA MORADA",
];

const PREMIUM_TOPPING_NAMES = [
  "QUESO FETA",
  "QUESO MANCHEGO",
  "QUESO DE CABRA",
  "QUESO PARMESANO",
  "TOCINO",
];

const regularProteins = new Set(REGULAR_PROTEIN_NAMES);
const premiumProteins = new Set(PREMIUM_PROTEIN_NAMES);
const regularToppings = new Set(REGULAR_TOPPING_NAMES);
const premiumToppings = new Set(PREMIUM_TOPPING_NAMES);

export const isPremiumProteinIngredient = (ingredient: Ingredient) =>
  (() => {
    const name = normalizeName(ingredient.name);
    if (regularProteins.has(name)) return false;
    if (premiumProteins.has(name)) return true;
    return ingredient.is_premium;
  })();

export const isPremiumToppingIngredient = (ingredient: Ingredient) =>
  (() => {
    const name = normalizeName(ingredient.name);
    if (regularToppings.has(name)) return false;
    if (premiumToppings.has(name)) return true;
    return ingredient.is_premium;
  })();

export const isAllowedSaladProtein = (ingredient: Ingredient) => {
  if (ingredient.type !== "proteina") return false;
  const name = normalizeName(ingredient.name);
  // Permit all proteins from DB so menu changes don't break "Arma tu ensalada".
  // If not listed explicitly, pricing falls back to ingredient.is_premium.
  if (regularProteins.has(name) || premiumProteins.has(name)) return true;
  return true;
};

export const isAllowedSaladTopping = (ingredient: Ingredient) => {
  if (ingredient.type !== "topping") return false;
  const name = normalizeName(ingredient.name);
  // Permit all toppings from DB so menu changes don't break "Arma tu ensalada".
  // If not listed explicitly, pricing falls back to ingredient.is_premium.
  if (regularToppings.has(name) || premiumToppings.has(name)) return true;
  return true;
};
