import { useState } from "react";
import { Header } from "@/components/pos/Header";
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

  // Auto-select first category
  if (!selectedCategory && categories && categories.length > 0) {
    setSelectedCategory(categories[0].id);
  }

  const selectedCategoryData = categories?.find((category) => category.id === selectedCategory) || null;

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
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header />
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
              categories={categories || []}
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
    </div>
  );
};

export default Index;
