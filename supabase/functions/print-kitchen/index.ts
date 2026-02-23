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
      orderNumber = null,
      customerName = "Cliente",
    } = body;

    const data: PrinterData[] = [];

    // Space
    data.push(createTextEntry(" "));

    // Header
    data.push(createTextEntry("COMANDA", 1, 1, 3));
    data.push(createTextEntry(`#${orderNumber || "---"}`, 1, 1, 1));

    // Separator
    data.push(createTextEntry("=".repeat(32), 0, 0, 0));

    // Client and time
    data.push(createTextEntry(`👤 ${customerName}`, 1, 0, 0));

    const dateStr = new Date().toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
    data.push(createTextEntry(`🕐 ${dateStr}`, 0, 0, 0));

    // Separator
    data.push(createTextEntry("=".repeat(32), 0, 0, 0));

    // Items
    items.forEach((item: CartItem) => {
      const itemLine = `${item.quantity}x ${(item.product?.name || "Item").toUpperCase()}`;
      data.push(createTextEntry(itemLine, 1, 0, 0));

      if (item.productSize) {
        data.push(
          createTextEntry(`  Tamaño: ${item.productSize.name}`, 0, 0, 0)
        );
      }

      if (item.customLabel) {
        data.push(createTextEntry(`  • ${item.customLabel}`, 0, 0, 0));
      }
    });

    // Separator
    data.push(createTextEntry("=".repeat(32), 0, 0, 0));

    // Action
    data.push(createTextEntry("PREPARAR AHORA", 1, 1, 3));

    data.push(createTextEntry(" "));

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
