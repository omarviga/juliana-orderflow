import { supabase } from "@/integrations/supabase/client";
import type { PaymentMethod } from "@/lib/cash-register";

const OFFLINE_ORDERS_KEY = "offline_pending_orders_v1";
const OFFLINE_ORDER_NUMBER_KEY = "offline_order_number_seq_v1";

export interface OfflineOrderItem {
  productId: string;
  productSizeId: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  customLabel: string | null;
  customizationIngredientIds: string[];
}

export interface OfflineOrderPayload {
  localId: string;
  localOrderNumber: number;
  createdAt: string;
  customerName: string;
  total: number;
  paymentMethod: PaymentMethod;
  items: OfflineOrderItem[];
}

function readQueue(): OfflineOrderPayload[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: OfflineOrderPayload[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(OFFLINE_ORDERS_KEY, JSON.stringify(queue));
}

function nextOfflineOrderNumber(): number {
  if (typeof window === "undefined") return Date.now();
  const current = Number.parseInt(localStorage.getItem(OFFLINE_ORDER_NUMBER_KEY) || "8000", 10);
  const next = Number.isNaN(current) ? 8001 : current + 1;
  localStorage.setItem(OFFLINE_ORDER_NUMBER_KEY, String(next));
  return next;
}

export function getPendingOfflineOrdersCount(): number {
  return readQueue().length;
}

export function enqueueOfflineOrder(
  order: Omit<OfflineOrderPayload, "localId" | "localOrderNumber" | "createdAt">
): OfflineOrderPayload {
  const payload: OfflineOrderPayload = {
    ...order,
    localId: crypto.randomUUID(),
    localOrderNumber: nextOfflineOrderNumber(),
    createdAt: new Date().toISOString(),
  };

  const queue = readQueue();
  queue.push(payload);
  writeQueue(queue);
  return payload;
}

function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("fetch") || msg.includes("network") || msg.includes("failed to fetch");
}

async function persistOrder(order: OfflineOrderPayload): Promise<boolean> {
  try {
    const { data: insertedOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        total: order.total,
        status: "pagado",
        customer_name: order.customerName,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    for (const item of order.items) {
      const { data: orderItem, error: itemError } = await supabase
        .from("order_items")
        .insert({
          order_id: insertedOrder.id,
          product_id: item.productId,
          product_size_id: item.productSizeId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal,
          custom_label: item.customLabel,
        })
        .select()
        .single();

      if (itemError) throw itemError;

      if (item.customizationIngredientIds.length > 0) {
        const rows = item.customizationIngredientIds.map((ingredientId) => ({
          order_item_id: orderItem.id,
          ingredient_id: ingredientId,
        }));
        const { error: customizationError } = await supabase
          .from("order_item_customizations")
          .insert(rows);

        if (customizationError) throw customizationError;
      }
    }

    return true;
  } catch (error) {
    if (isNetworkError(error)) {
      return false;
    }
    return false;
  }
}

export async function syncPendingOfflineOrders() {
  const queue = readQueue();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0 };
  }

  const remaining: OfflineOrderPayload[] = [];
  let synced = 0;

  for (const order of queue) {
    const ok = await persistOrder(order);
    if (ok) {
      synced += 1;
    } else {
      remaining.push(order);
    }
  }

  writeQueue(remaining);
  return { synced, remaining: remaining.length };
}

