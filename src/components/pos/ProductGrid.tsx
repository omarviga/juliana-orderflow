import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Product, ProductSize } from "@/types/pos";
import { useState } from "react";
import { cn } from "@/lib/utils";

const BEVERAGE_PRICE_OVERRIDES: Record<string, number> = {
  "AGUA DE LA CASA": 25,
  "AGUA EMBOTELLADA": 15,
  "AGUA GASIFICADA": 27,
  REFRESCO: 27,
  "CAFE AMERICANO": 40,
  CAPUCHINO: 65,
  "CAFE LATTE": 55,
  "CAFE HELADO": 40,
};

const HIDDEN_BEVERAGE_NAMES = new Set(["TE"]);
const REQUIRED_BEVERAGES = [
  { name: "Café Latte", price: 55 },
  { name: "Café Helado", price: 40 },
];

const normalizeText = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getDisplayPrice = (product: Product, isBeverageCategory: boolean) => {
  if (!isBeverageCategory) return product.price;
  const key = normalizeText(product.name);
  return BEVERAGE_PRICE_OVERRIDES[key] ?? product.price;
};

interface Props {
  products: Product[];
  categoryName?: string;
  productSizes: ProductSize[];
  onAddToCart: (product: Product, price: number, size?: ProductSize) => void;
  onCustomize: (product: Product) => void;
  onCustomizeHouseSalad: (product: Product) => void;
}

export function ProductGrid({
  products,
  categoryName,
  productSizes,
  onAddToCart,
  onCustomize,
  onCustomizeHouseSalad,
}: Props) {
  // Normalize category name for comparison (remove accents)
  const normalizedCategory = (categoryName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const isSandwichCategory = normalizedCategory.includes("sandwich");
  const isBaguetteCategory = normalizedCategory.includes("baguette");
  const isHouseSaladCategory = normalizedCategory.includes("ensaladas");
  const isBeverageCategory = normalizedCategory.includes("bebida");
  const visibleProducts = isBeverageCategory
    ? products.filter((product) => !HIDDEN_BEVERAGE_NAMES.has(normalizeText(product.name)))
    : products;
  const displayProducts = (() => {
    if (!isBeverageCategory) return visibleProducts;

    const existingNames = new Set(visibleProducts.map((product) => normalizeText(product.name)));
    const categoryId = visibleProducts[0]?.category_id || products[0]?.category_id || "";
    const createdAt = new Date().toISOString();

    const injectedProducts = REQUIRED_BEVERAGES
      .filter((beverage) => !existingNames.has(normalizeText(beverage.name)))
      .map((beverage, index) => ({
        id: `virtual-beverage-${normalizeText(beverage.name)}`,
        category_id: categoryId,
        created_at: createdAt,
        description: null,
        display_order: 9000 + index,
        is_customizable: false,
        name: beverage.name,
        price: beverage.price,
      } as Product));

    return [...visibleProducts, ...injectedProducts];
  })();

  if (isSandwichCategory) {
    return (
      <div className="space-y-6 p-3">
        <SectionedProductGrid
          title="Sandwiches"
          products={products}
          productSizes={productSizes}
          filterSizeNames={["S"]}
          onAddToCart={onAddToCart}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-3 lg:grid-cols-3">
      {displayProducts.map((product) => {
        const sizes = productSizes.filter((s) => s.product_id === product.id);
        const hasSizes = sizes.length > 0;

        if (product.is_customizable) {
          return (
            <Card
              key={product.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => onCustomize(product)}
            >
              <CardContent className="flex flex-col items-center justify-center p-4 text-center">
                <span className="mb-2 text-2xl">🥗</span>
                <h3 className="font-semibold text-foreground">{product.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">Desde $110</p>
                <Button size="sm" className="mt-3 w-full gap-1" variant="default">
                  <Plus className="h-4 w-4" /> Personalizar
                </Button>
              </CardContent>
            </Card>
          );
        }

        if (hasSizes && !product.price) {
          return (
            <SizedProductCard
              key={product.id}
              product={product}
              sizes={sizes}
              onAdd={onAddToCart}
            />
          );
        }

        return (
          <Card key={product.id} className="transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-center justify-center p-4 text-center">
              {(() => {
                const displayPrice = getDisplayPrice(product, isBeverageCategory);
                return (
                  <>
                    <h3 className="font-semibold text-foreground">{product.name}</h3>
                    <p className="mt-1 text-lg font-bold text-primary">
                      ${displayPrice?.toFixed(0)}
                    </p>
                    <Button
                      size="sm"
                      className="mt-3 w-full gap-1"
                      onClick={() =>
                        isHouseSaladCategory
                          ? onCustomizeHouseSalad(product)
                          : onAddToCart(product, displayPrice!, undefined)
                      }
                    >
                      <Plus className="h-4 w-4" /> {isHouseSaladCategory ? "Agregar extras" : "Agregar"}
                    </Button>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SectionedProductGrid({
  title,
  products,
  productSizes,
  filterSizeNames,
  onAddToCart,
}: {
  title: string;
  products: Product[];
  productSizes: ProductSize[];
  filterSizeNames: string[];
  onAddToCart: (product: Product, price: number, size?: ProductSize) => void;
}) {
  const cards = products
    .map((product) => {
      const sizes = productSizes
        .filter((s) => s.product_id === product.id)
        .filter((size) => filterSizeNames.includes(size.name.toUpperCase()));

      if (sizes.length === 0) return null;

      // Si es la sección "Sandwiches" (tamaño S único), mostrar de forma simplificada
      const isSimplified = title === "Sandwiches" && sizes.length === 1;

      return (
        <SizedProductCard
          key={`${product.id}-${title}`}
          product={product}
          sizes={sizes}
          onAdd={onAddToCart}
          isSimplified={isSimplified}
        />
      );
    })
    .filter(Boolean);

  if (cards.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{cards}</div>
    </section>
  );
}

function SizedProductCard({
  product,
  sizes,
  onAdd,
  isSimplified = false,
}: {
  product: Product;
  sizes: ProductSize[];
  onAdd: (product: Product, price: number, size?: ProductSize) => void;
  isSimplified?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedSize = sizes.find((s) => s.id === selected);

  // Simplified view: show only price without size selector
  if (isSimplified && sizes.length === 1) {
    const size = sizes[0];
    return (
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col items-center justify-center p-4 text-center">
          <h3 className="font-semibold text-foreground">{product.name}</h3>
          <p className="mt-2 text-lg font-bold text-primary">${size.price.toFixed(0)}</p>
          <Button
            size="sm"
            className="mt-3 w-full gap-1"
            onClick={() => onAdd(product, size.price, size)}
          >
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Default view: show size selector
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col items-center justify-center p-4 text-center">
        <h3 className="font-semibold text-foreground">{product.name}</h3>
        <div className="mt-2 flex gap-2">
          {sizes.map((size) => (
            <button
              key={size.id}
              onClick={() => setSelected(size.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                selected === size.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent"
              )}
            >
              {size.name} ${size.price.toFixed(0)}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-3 w-full gap-1"
          disabled={!selectedSize}
          onClick={() => {
            if (selectedSize) {
              onAdd(product, selectedSize.price, selectedSize);
              setSelected(null);
            }
          }}
        >
          <Plus className="h-4 w-4" /> Agregar
        </Button>
      </CardContent>
    </Card>
  );
}

