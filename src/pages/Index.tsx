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

const Index = () => {
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: products, isLoading: prodLoading } = useProducts();
  const { data: productSizes } = useProductSizes();
  const { data: ingredients } = useIngredients();

  const cart = useCart();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customizeProduct, setCustomizeProduct] = useState<Product | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [houseSaladProduct, setHouseSaladProduct] = useState<Product | null>(null);

  const visibleCategories = useMemo(() => {
    if (!categories || categories.length === 0) return [];

    const productCountByCategoryId = new Map<string, number>();
    for (const product of products || []) {
      productCountByCategoryId.set(
        product.category_id,
        (productCountByCategoryId.get(product.category_id) || 0) + 1
      );
    }

    const normalizeCategoryName = (value: string) =>
      value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const groupedByName = new Map<string, typeof categories>();
    for (const category of categories) {
      const key = normalizeCategoryName(category.name);
      const group = groupedByName.get(key) || [];
      group.push(category);
      groupedByName.set(key, group);
    }

    return categories.filter((category) => {
      const key = normalizeCategoryName(category.name);
      const group = groupedByName.get(key) || [];
      if (group.length <= 1) return true;

      // For duplicated names (e.g. Baguettes), keep the one with more products.
      const preferred = [...group].sort((a, b) => {
        const aCount = productCountByCategoryId.get(a.id) || 0;
        const bCount = productCountByCategoryId.get(b.id) || 0;
        return bCount - aCount;
      })[0];

      return preferred.id === category.id;
    });
  }, [categories, products]);

  useEffect(() => {
    if (visibleCategories.length === 0) return;

    const selectedIsVisible = visibleCategories.some((category) => category.id === selectedCategory);
    if (!selectedCategory || !selectedIsVisible) {
      setSelectedCategory(visibleCategories[0].id);
    }
  }, [selectedCategory, visibleCategories]);

  const selectedCategoryData =
    visibleCategories.find((category) => category.id === selectedCategory) || null;

  const filteredProducts =
    products?.filter((p) => p.category_id === selectedCategory) || [];

  const customizableSizes =
    customizeProduct && productSizes
      ? productSizes.filter((s) => s.product_id === customizeProduct.id)
      : [];

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
    label: string
  ) => {
    cart.addItem(product, unitPrice, 1, undefined, customizations, label);
  };

  const isLoading = catLoading || prodLoading;

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
              onCustomizeHouseSalad={setHouseSaladProduct}
            />
          )}
        </main>

        {/* Cart */}
        <aside className="w-72 shrink-0 lg:w-80">
          <CartPanel
            items={cart.items}
            total={cart.total}
            onUpdateQuantity={cart.updateQuantity}
            onRemove={cart.removeItem}
            onClear={cart.clearCart}
            onPay={() => setShowPayment(true)}
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
          product={houseSaladProduct}
          ingredients={ingredients || []}
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
      />
    </Layout>
  );
};

export default Index;
