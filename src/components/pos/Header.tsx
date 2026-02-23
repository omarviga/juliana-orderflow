import { Home, Users, ClipboardList, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrinterConfig } from "./PrinterConfig";
import { useNavigate, useLocation } from "react-router-dom";

const navItems = [
  { icon: Home, label: "Inicio", path: "/" },
  { icon: Users, label: "Clientes", path: "/clients" },
  { icon: ClipboardList, label: "Pedidos", path: "/orders" },
  { icon: Settings, label: "Ajustes", path: "/settings" },
];

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="flex items-center justify-between border-b bg-card px-4 py-2">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight text-primary">
          JULIANA — BARRA COTIDIANA
        </h1>
      </div>
      <nav className="flex items-center gap-1">
        {navItems.map((item) => (
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
            Operador 001
          </span>
        </div>
      </nav>
    </header>
  );
}
