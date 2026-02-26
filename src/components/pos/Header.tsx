import { Home, ClipboardList, Settings, LogOut, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrinterConfig } from "./PrinterConfig";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const navItems = [
  { icon: Home, label: "Inicio", path: "/" as const, adminOnly: false },
  { icon: BarChart3, label: "Dashboard", path: "/dashboard" as const, adminOnly: true },
  { icon: ClipboardList, label: "Pedidos", path: "/orders" as const, adminOnly: true },
  { icon: Settings, label: "Ajustes", path: "/settings" as const, adminOnly: true },
];

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, user, signOut } = useAuth();

  const visibleNavItems = navItems.filter((item) => (item.adminOnly ? role === "admin" : true));

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cerrar sesión";
      toast.error(message);
    }
  };

  return (
    <header className="flex items-center justify-between border-b bg-card px-4 py-2">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight text-primary">
          JULIANA — BARRA COTIDIANA
        </h1>
      </div>
      <nav className="flex items-center gap-1">
        {visibleNavItems.map((item) => (
          <Button
            key={item.label}
            variant={location.pathname === item.path ? "default" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => navigate(item.path)}
          >
            <item.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </Button>
        ))}
        <div className="ml-3 flex items-center gap-2">
          <PrinterConfig />
          <span className="rounded-md bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {user?.email || "Operador"}
          </span>
          <span className="rounded-md bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {role === "admin" ? "Admin" : "Operador"}
          </span>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </nav>
    </header>
  );
}
