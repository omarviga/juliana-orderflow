import { generateKitchenOrderHTML, generateClientTicketHTML } from "@/lib/printer-formats";
import type { CartItem } from "@/types/pos";

// Mock data para prueba
const mockProduct = {
  id: "123",
  category_id: "cat-1",
  name: "Ensalada House",
  description: "Ensalada fresca",
  price: 125,
  is_customizable: true,
  display_order: 1,
  created_at: new Date().toISOString(),
};

const mockIngredient = {
  id: "ing-1",
  type: "proteina" as const,
  name: "Pollo",
  is_premium: false,
  display_order: 1,
  created_at: new Date().toISOString(),
};

const mockCartItem: CartItem = {
  id: "cart-1",
  product: mockProduct,
  quantity: 1,
  unitPrice: 125,
  subtotal: 125,
  customizations: [
    {
      ingredient: mockIngredient,
      extraCost: 0,
    },
  ],
  customLabel: "Sin croutones",
};

describe("Printer Formats", () => {
  test("generateKitchenOrderHTML debe incluir nombre del cliente", () => {
    const html = generateKitchenOrderHTML(
      [mockCartItem],
      123,
      "Juan",
      "23/02/2026 10:30"
    );

    expect(html).toContain("JUAN"); // En mayúsculas
    expect(html).toContain("COMANDA #123");
  });

  test("generateKitchenOrderHTML debe incluir ingredientes", () => {
    const html = generateKitchenOrderHTML(
      [mockCartItem],
      123,
      "Juan",
      "23/02/2026 10:30"
    );

    expect(html).toContain("Pollo");
    expect(html).toContain("Sin croutones");
  });

  test("generateKitchenOrderHTML debe incluir nombre del producto", () => {
    const html = generateKitchenOrderHTML(
      [mockCartItem],
      123,
      "Juan",
      "23/02/2026 10:30"
    );

    expect(html).toContain("Ensalada House");
  });

  test("generateClientTicketHTML debe incluir total", () => {
    const html = generateClientTicketHTML(
      [mockCartItem],
      125,
      123,
      "Juan",
      "23/02/2026 10:30"
    );

    expect(html).toContain("$125");
  });

  test("generateClientTicketHTML debe incluir nombre del cliente", () => {
    const html = generateClientTicketHTML(
      [mockCartItem],
      125,
      123,
      "Juan",
      "23/02/2026 10:30"
    );

    expect(html).toContain("Juan");
  });

  test("HTML debe ser válido", () => {
    const html = generateKitchenOrderHTML(
      [mockCartItem],
      123,
      "Juan",
      "23/02/2026 10:30"
    );

    // Verificar estructura HTML básica
    expect(html).toContain("<html>");
    expect(html).toContain("</html>");
    expect(html).toContain("<head>");
    expect(html).toContain("</head>");
    expect(html).toContain("<body>");
    expect(html).toContain("</body>");
  });
});
