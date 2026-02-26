interface PrintGatewayConfig {
  baseUrl: string;
  token?: string;
  timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 5000;

function getGatewayConfig(): PrintGatewayConfig | null {
  const baseUrl = import.meta.env.VITE_PRINT_GATEWAY_URL as string | undefined;
  if (!baseUrl) return null;
  const token = import.meta.env.VITE_PRINT_GATEWAY_TOKEN as string | undefined;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    token,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

export function isPrintGatewayConfigured(): boolean {
  return Boolean(import.meta.env.VITE_PRINT_GATEWAY_URL);
}

async function postToGateway<TBody extends Record<string, unknown>>(
  path: string,
  body: TBody
): Promise<boolean> {
  const config = getGatewayConfig();
  if (!config) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.token ? { "x-print-token": config.token } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    return response.ok;
  } catch (error) {
    console.error("[print-gateway] request failed:", error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function printTicketViaGateway(payload: {
  orderNumber: number | null;
  customerName: string;
  paymentMethodLabel: string;
  total: number;
  items: Array<{
    quantity: number;
    subtotal: number;
    product?: { name: string };
    productSize?: { name: string } | null;
    customLabel?: string | null;
  }>;
  dateStr?: string;
}): Promise<boolean> {
  return postToGateway("/api/print/ticket", payload);
}

export function printKitchenViaGateway(payload: {
  orderNumber: number | null;
  customerName: string;
  items: Array<{
    quantity: number;
    product?: { name: string };
    productSize?: { name: string } | null;
    customLabel?: string | null;
  }>;
  dateStr?: string;
}): Promise<boolean> {
  return postToGateway("/api/print/kitchen", payload);
}

export function printCashCutViaGateway(payload: {
  title: string;
  generatedAt: string;
  salesCount: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  entries: Array<{ label: string; value: number; quantity: number }>;
}): Promise<boolean> {
  return postToGateway("/api/print/cash-cut", payload);
}
