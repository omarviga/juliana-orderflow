import { Home, Users, ClipboardList, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { icon: Home, label: "Inicio" },
  { icon: Users, label: "Clientes" },
  { icon: ClipboardList, label: "Pedidos" },
  { icon: Settings, label: "Ajustes" },
];

export function Header() {
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
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
          >
            <item.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{item.label}</span>
          </Button>
        ))}
        <span className="ml-3 rounded-md bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Operador 001
        </span>
      </nav>
    </header>
  );
}
