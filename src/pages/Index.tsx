import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { CategoryList } from "@/components/pos/CategoryList";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { CartPanel } from "@/components/pos/CartPanel";
import { CustomSaladModal } from "@/components/pos/CustomSaladModal";
import { PaymentModal } from "@/components/pos/PaymentModal";
import { HouseSaladExtrasModal } from "@/components/pos/HouseSaladExtrasModal";
import { useCategories, useProducts, useProductSizes, useIngredients } from "@/hooks/useMenuData";
import { useCart } from "@/hooks/useCart";
import type { Product, ProductSize, SelectedIngredient } from "@/types/pos";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { isCashRegisterOpenToday } from "@/lib/cash-register";

const STANDALONE_EXTRA_PRODUCT_CANDIDATES = new Set([
  "EXTRA SUELTO",
  "EXTRAS SUELTOS",
  "EXTRA INDEPENDIENTE",
  "EXTRAS",
]);
const HIDDEN_CATEGORY_NAMES = new Set(["extras"]);

const normalizeText = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const Index = () => {
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: products, isLoading: prodLoading } = useProducts();
  const { data: productSizes } = useProductSizes();
  const { data: ingredients } = useIngredients();

  const cart = useCart();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customizeProduct, setCustomizeProduct] = useState<Product | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [cashRegisterOpen, setCashRegisterOpen] = useState(false);
  const [showStandaloneExtras, setShowStandaloneExtras] = useState(false);
  const [houseSaladProduct, setHouseSaladProduct] = useState<{
    product: Product;
    size?: ProductSize;
  } | null>(null);

  const visibleCategories = useMemo(() => {
    if (!categories || categories.length === 0) return [];

    const normalizeCategoryName = (value: string) =>
      value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const deduped = new Map<string, (typeof categories)[number]>();

    for (const category of categories) {
      const key = normalizeCategoryName(category.name);
      if (HIDDEN_CATEGORY_NAMES.has(key)) continue;
      if (!deduped.has(key)) {
        deduped.set(key, category);
      }
    }

    return [...deduped.values()];
  }, [categories]);

  useEffect(() => {
    setCashRegisterOpen(isCashRegisterOpenToday());
  }, []);

  useEffect(() => {
    const syncCashRegisterState = () => setCashRegisterOpen(isCashRegisterOpenToday());
    window.addEventListener("focus", syncCashRegisterState);
    document.addEventListener("visibilitychange", syncCashRegisterState);
    return () => {
      window.removeEventListener("focus", syncCashRegisterState);
      document.removeEventListener("visibilitychange", syncCashRegisterState);
    };
  }, []);

  useEffect(() => {
    if (visibleCategories.length === 0) return;

    const selectedIsVisible = visibleCategories.some((category) => category.id === selectedCategory);
    if (!selectedCategory || !selectedIsVisible) {
      setSelectedCategory(visibleCategories[0].id);
    }
  }, [selectedCategory, visibleCategories]);

  const selectedCategoryData =
    visibleCategories.find((category) => category.id === selectedCategory) || null;

  const filteredProducts = useMemo(() => {
    const categoryProducts = products?.filter((p) => p.category_id === selectedCategory) || [];
    const dedupedByName = new Map<string, Product>();

    for (const product of categoryProducts) {
      const key = normalizeText(product.name);
      const existing = dedupedByName.get(key);
      if (!existing) {
        dedupedByName.set(key, product);
        continue;
      }

      // Keep the product with lower display_order, fallback to oldest created_at.
      if (product.display_order < existing.display_order) {
        dedupedByName.set(key, product);
        continue;
      }

      if (
        product.display_order === existing.display_order &&
        new Date(product.created_at).getTime() < new Date(existing.created_at).getTime()
      ) {
        dedupedByName.set(key, product);
      }
    }

    return [...dedupedByName.values()].sort((a, b) => a.display_order - b.display_order);
  }, [products, selectedCategory]);

  const customizableSizes =
    customizeProduct && productSizes
      ? productSizes.filter((s) => s.product_id === customizeProduct.id)
      : [];

  const standaloneExtrasProduct = useMemo(
    () =>
      (products || []).find((product) =>
        STANDALONE_EXTRA_PRODUCT_CANDIDATES.has(normalizeText(product.name))
      ) || null,
    [products]
  );

  const handleAddToCart = (product: Product, price: number, size?: ProductSize) => {
    cart.addItem(product, price, 1, size);
  };

  const handleCustomSaladAdd = (
    product: Product,
    unitPrice: number,
    size: ProductSize,
    customizations: SelectedIngredient[],
    label: string
  ) => {
    cart.addItem(product, unitPrice, 1, size, customizations, label);
  };

  const handleHouseSaladAdd = (
    product: Product,
    unitPrice: number,
    customizations: SelectedIngredient[],
    label: string,
    productSize?: ProductSize
  ) => {
    cart.addItem(product, unitPrice, 1, productSize, customizations, label);
  };

  const isLoading = catLoading || prodLoading;

  const refreshCashRegisterState = () => {
    setCashRegisterOpen(isCashRegisterOpenToday());
  };

  const handleOpenPayment = () => {
    refreshCashRegisterState();
    if (!isCashRegisterOpenToday()) {
      toast.error("Caja cerrada. Debes registrar apertura de caja para poder cobrar.");
      return;
    }
    setShowPayment(true);
  };

  const handleOpenStandaloneExtras = () => {
    if (!standaloneExtrasProduct) {
      toast.error("No se encontró el producto base de extras. Ejecuta la migración de Extras.");
      return;
    }
    setShowStandaloneExtras(true);
  };

  return (
    <Layout>
      <div className="flex flex-1 overflow-hidden">
        {/* Categories */}
        <aside className="w-48 shrink-0 overflow-y-auto border-r bg-card lg:w-56">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <CategoryList
              categories={visibleCategories}
              selectedId={selectedCategory}
              onSelect={setSelectedCategory}
            />
          )}
        </aside>

        {/* Products */}
        <main className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 p-3 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : (
            <ProductGrid
              products={filteredProducts}
              categoryName={selectedCategoryData?.name}
              productSizes={productSizes || []}
              onAddToCart={handleAddToCart}
              onCustomize={setCustomizeProduct}
              onCustomizeHouseSalad={(product, size) => setHouseSaladProduct({ product, size })}
            />
          )}
        </main>

        {/* Cart */}
        <aside className="w-72 shrink-0 lg:w-80">
          <CartPanel
            items={cart.items}
            total={cart.total}
            onUpdateQuantity={cart.updateQuantity}
            onUpdateKitchenNote={cart.updateKitchenNote}
            onRemove={cart.removeItem}
            onClear={cart.clearCart}
            onPay={handleOpenPayment}
            payDisabled={!cashRegisterOpen}
            onAddStandaloneExtra={handleOpenStandaloneExtras}
          />
        </aside>
      </div>

      {/* Custom Salad Modal */}
      {customizeProduct && (
        <CustomSaladModal
          open={!!customizeProduct}
          onClose={() => setCustomizeProduct(null)}
          product={customizeProduct}
          sizes={customizableSizes}
          ingredients={ingredients || []}
          onAddToCart={handleCustomSaladAdd}
        />
      )}

      {houseSaladProduct && (
        <HouseSaladExtrasModal
          open={!!houseSaladProduct}
          onClose={() => setHouseSaladProduct(null)}
          product={houseSaladProduct.product}
          productSize={houseSaladProduct.size}
          ingredients={ingredients || []}
          onAddToCart={handleHouseSaladAdd}
        />
      )}

      {showStandaloneExtras && standaloneExtrasProduct && (
        <HouseSaladExtrasModal
          open={showStandaloneExtras}
          onClose={() => setShowStandaloneExtras(false)}
          product={standaloneExtrasProduct}
          ingredients={ingredients || []}
          title="Extras independientes"
          requireAtLeastOneSelection
          onAddToCart={handleHouseSaladAdd}
        />
      )}

      {/* Payment Modal */}
      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        items={cart.items}
        total={cart.total}
        onOrderComplete={cart.clearCart}
        canProcessPayment={cashRegisterOpen}
      />
    </Layout>
  );
};

export default Index;
