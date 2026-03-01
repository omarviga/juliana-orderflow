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

const sanitizeProductName = (name: string) =>
  name
    .replace(/[{}]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function getDisplayProductName(name: string): string {
  const cleanedName = sanitizeProductName(name);
  if (STANDALONE_EXTRA_PRODUCT_NAMES.has(normalizeText(cleanedName))) {
    return "Extra";
  }

  return cleanedName;
}

