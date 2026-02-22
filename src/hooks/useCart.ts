import { useState, useCallback } from "react";
import type { CartItem, Product, ProductSize, SelectedIngredient } from "@/types/pos";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback(
    (
      product: Product,
      unitPrice: number,
      quantity: number = 1,
      productSize?: ProductSize,
      customizations?: SelectedIngredient[],
      customLabel?: string
    ) => {
      const id = crypto.randomUUID();
      const newItem: CartItem = {
        id,
        product,
        productSize,
        quantity,
        unitPrice,
        subtotal: unitPrice * quantity,
        customizations,
        customLabel,
      };
      setItems((prev) => [...prev, newItem]);
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity, subtotal: item.unitPrice * quantity }
          : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const total = items.reduce((sum, item) => sum + item.subtotal, 0);

  return { items, addItem, removeItem, updateQuantity, clearCart, total };
}
