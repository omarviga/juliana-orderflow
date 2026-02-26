import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/hooks/useDashboardData";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export default function DashboardPage() {
  const {
    isLoading,
    error,
    todaySales,
    monthSales,
    todayOrdersCount,
    avgTicket,
    statusToday,
    topProducts,
    salesByDay,
    hourlyToday,
    recentPaidOrders,
  } = useDashboardData();

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="p-6 text-sm text-destructive">
          No se pudo cargar el dashboard.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumen de ventas y operación (últimos 90 días).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Ventas hoy" value={money.format(todaySales)} />
          <MetricCard title="Pedidos pagados hoy" value={String(todayOrdersCount)} />
          <MetricCard title="Ticket promedio hoy" value={money.format(avgTicket)} />
          <MetricCard title="Ventas del mes" value={money.format(monthSales)} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ventas últimos 7 días</CardTitle>
              <CardDescription>Total vendido por día</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(v: number) => money.format(v)} />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Demanda por hora (hoy)</CardTitle>
              <CardDescription>Pedidos pagados por franja horaria</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hourlyToday}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" interval={2} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Productos más vendidos (30 días)</CardTitle>
              <CardDescription>Top por cantidad y facturación</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topProducts.map((product, idx) => (
                  <div
                    key={product.name}
                    className="grid grid-cols-[44px_1fr_90px_120px] items-center gap-2 rounded-md border p-2"
                  >
                    <Badge variant="secondary">#{idx + 1}</Badge>
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="text-right text-sm">{product.qty} uds</p>
                    <p className="text-right text-sm font-semibold">{money.format(product.revenue)}</p>
                  </div>
                ))}
                {topProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin ventas en los últimos 30 días.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estado de pedidos (hoy)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <StatusRow label="Pagados" value={statusToday.pagado} tone="default" />
              <StatusRow label="Pendientes" value={statusToday.pendiente} tone="secondary" />
              <StatusRow label="Cancelados" value={statusToday.cancelado} tone="destructive" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Últimos pedidos pagados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentPaidOrders.map((order) => (
                <div
                  key={order.id}
                  className="grid grid-cols-[110px_1fr_140px_150px] items-center gap-2 rounded-md border p-2 text-sm"
                >
                  <p className="font-semibold">#{order.order_number}</p>
                  <p className="truncate text-muted-foreground">{order.customer_name || "Mostrador"}</p>
                  <p>{new Date(order.created_at).toLocaleString("es-MX")}</p>
                  <p className="text-right font-semibold">{money.format(Number(order.total || 0))}</p>
                </div>
              ))}
              {recentPaidOrders.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay pedidos pagados recientes.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "secondary" | "destructive";
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-2">
      <span>{label}</span>
      <Badge variant={tone}>{value}</Badge>
    </div>
  );
}
