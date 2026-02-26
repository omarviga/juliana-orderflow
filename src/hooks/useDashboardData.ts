import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type OrderStatus = "pendiente" | "pagado" | "cancelado";

interface DashboardOrderItem {
  quantity: number;
  subtotal: number;
  unit_price: number;
  product?: {
    name: string;
  } | null;
}

interface DashboardOrder {
  id: string;
  order_number: number;
  total: number;
  status: OrderStatus;
  customer_name: string | null;
  created_at: string;
  order_items?: DashboardOrderItem[];
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function startOfToday(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isBetween(date: Date, from: Date, to: Date) {
  return date.getTime() >= from.getTime() && date.getTime() <= to.getTime();
}

export function useDashboardData() {
  const query = useQuery({
    queryKey: ["dashboard", "orders", "90d"],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - 90);

      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          total,
          status,
          customer_name,
          created_at,
          order_items(
            quantity,
            subtotal,
            unit_price,
            product:products(name)
          )
        `
        )
        .gte("created_at", from.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as DashboardOrder[];
    },
  });

  const computed = useMemo(() => {
    const orders = query.data || [];
    const now = new Date();
    const todayStart = startOfToday(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const last7Start = new Date(todayStart);
    last7Start.setDate(last7Start.getDate() - 6);
    const last30Start = new Date(todayStart);
    last30Start.setDate(last30Start.getDate() - 29);

    const paidOrders = orders.filter((order) => order.status === "pagado");
    const todayOrders = orders.filter((order) => isBetween(new Date(order.created_at), todayStart, now));
    const todayPaidOrders = paidOrders.filter((order) =>
      isBetween(new Date(order.created_at), todayStart, now)
    );
    const monthPaidOrders = paidOrders.filter((order) =>
      isBetween(new Date(order.created_at), monthStart, now)
    );

    const todaySales = todayPaidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const monthSales = monthPaidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const avgTicket = todayPaidOrders.length > 0 ? todaySales / todayPaidOrders.length : 0;

    const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
    const paidLast30 = paidOrders.filter((order) =>
      isBetween(new Date(order.created_at), last30Start, now)
    );

    for (const order of paidLast30) {
      for (const item of order.order_items || []) {
        const name = item.product?.name || "Producto";
        const existing = productMap.get(name) || { name, qty: 0, revenue: 0 };
        existing.qty += Number(item.quantity || 0);
        existing.revenue += Number(item.subtotal || 0);
        productMap.set(name, existing);
      }
    }

    const topProducts = [...productMap.values()]
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
      .slice(0, 10);

    const salesByDaySeed = Array.from({ length: 7 }).map((_, i) => {
      const day = new Date(last7Start);
      day.setDate(last7Start.getDate() + i);
      return {
        key: `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`,
        label: DAY_NAMES[day.getDay()],
        sales: 0,
        orders: 0,
      };
    });
    const salesByDayMap = new Map(salesByDaySeed.map((d) => [d.key, d]));

    for (const order of paidOrders) {
      const date = new Date(order.created_at);
      if (!isBetween(date, last7Start, now)) continue;
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const day = salesByDayMap.get(key);
      if (!day) continue;
      day.sales += Number(order.total || 0);
      day.orders += 1;
    }

    const salesByDay = salesByDaySeed.map((d) => ({
      label: d.label,
      sales: d.sales,
      orders: d.orders,
    }));

    const hourlyToday = Array.from({ length: 24 }).map((_, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}:00`,
      sales: 0,
      orders: 0,
    }));
    for (const order of todayPaidOrders) {
      const hour = new Date(order.created_at).getHours();
      hourlyToday[hour].sales += Number(order.total || 0);
      hourlyToday[hour].orders += 1;
    }

    const statusToday = {
      pagado: todayOrders.filter((o) => o.status === "pagado").length,
      pendiente: todayOrders.filter((o) => o.status === "pendiente").length,
      cancelado: todayOrders.filter((o) => o.status === "cancelado").length,
    };

    return {
      todaySales,
      monthSales,
      todayOrdersCount: todayPaidOrders.length,
      avgTicket,
      statusToday,
      topProducts,
      salesByDay,
      hourlyToday,
      recentPaidOrders: paidOrders.slice(0, 8),
    };
  }, [query.data]);

  return {
    ...computed,
    isLoading: query.isLoading,
    error: query.error,
  };
}
