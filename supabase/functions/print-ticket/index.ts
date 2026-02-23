import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface CartItem {
  quantity: number;
  product: {
    name: string;
  };
  productSize?: {
    name: string;
  };
  customLabel?: string;
  subtotal: number;
}

interface PrinterData {
  type: 0 | 1 | 2 | 3 | 4;
  content?: string;
  bold?: 0 | 1;
  align?: 0 | 1 | 2;
  format?: 0 | 1 | 2 | 3 | 4;
  path?: string;
  value?: string;
  width?: number;
  height?: number;
  size?: number;
}

function createTextEntry(
  content: string,
  bold: 0 | 1 = 0,
  align: 0 | 1 | 2 = 1,
  format: 0 | 1 | 2 | 3 | 4 = 0
): PrinterData {
  return {
    type: 0,
    content,
    bold,
    align,
    format,
  };
}

serve(async (req) => {
  // Load CORS headers
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await req.json();

    const {
      items = [],
      total = 0,
      orderNumber = null,
      customerName = "Cliente",
      businessName = "JULIANA",
      businessSubtitle = "BARRA COTIDIANA",
      businessAddress = "Av. Miguel Hidalgo #276",
      businessPhone = "Tel: 417 206 0111",
    } = body;

    const data: PrinterData[] = [];

    // Space
    data.push(createTextEntry(" "));

    // Header
    data.push(createTextEntry(businessName, 1, 1, 3));
    data.push(createTextEntry(businessSubtitle, 0, 1, 0));
    data.push(createTextEntry(businessAddress, 0, 1, 0));
    data.push(createTextEntry(businessPhone, 0, 1, 0));

    // Separator
    data.push(createTextEntry("=".repeat(42), 0, 0, 0));

    // Order info
    data.push(createTextEntry(`Pedido: #${orderNumber || "---"}`, 1, 0, 0));
    data.push(createTextEntry(`Nombre: ${customerName}`, 1, 0, 0));

    const dateStr = new Date().toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
    data.push(createTextEntry(dateStr, 0, 0, 0));

    // Separator
    data.push(createTextEntry("=".repeat(42), 0, 0, 0));

    // Items
    items.forEach((item: CartItem) => {
      const itemLine = `${item.quantity}x ${item.product?.name || "Item"}${
        item.productSize ? ` (${item.productSize.name})` : ""
      }`;
      const priceLine = `$${(item.subtotal || 0).toFixed(0)}`;

      data.push({
        type: 4,
        content: `<div style="display: flex; justify-content: space-between;"><span>${itemLine}</span><span style="text-align: right;">${priceLine}</span></div>`,
      });

      if (item.customLabel) {
        data.push(createTextEntry(`  • ${item.customLabel}`, 0, 0, 4));
      }
    });

    // Separator
    data.push(createTextEntry("=".repeat(42), 0, 0, 0));

    // Total
    data.push(createTextEntry(`TOTAL: $${total.toFixed(0)}`, 1, 1, 3));

    // Separator
    data.push(createTextEntry("=".repeat(42), 0, 0, 0));

    // Footer
    data.push(createTextEntry("¡Gracias por tu visita!", 0, 1, 0));
    data.push(createTextEntry("Vuelve pronto", 0, 1, 0));
    data.push(createTextEntry(" ", 0, 1, 0));

    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
