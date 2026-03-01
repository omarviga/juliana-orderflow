import { useState } from "react";
import { Home, ClipboardList, Settings, LogOut, BarChart3, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const handleNavigate = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(path);
      return;
    }
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="flex items-center justify-between border-b bg-card px-3 py-2 sm:px-4">
      <div className="min-w-0 flex items-center gap-2 sm:gap-3">
        <h1 className="truncate text-sm font-bold tracking-tight text-primary sm:text-lg">
          JULIANA — BARRA COTIDIANA
        </h1>
      </div>

      <nav className="hidden items-center gap-1 lg:flex">
        {visibleNavItems.map((item) => (
          <Button
            key={item.label}
            variant={location.pathname === item.path ? "default" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => handleNavigate(item.path)}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Button>
        ))}
        <div className="ml-3 flex items-center gap-2">
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

      <div className="flex items-center gap-2 lg:hidden">
        <span className="hidden rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
          {role === "admin" ? "Admin" : "Operador"}
        </span>
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Abrir menú">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-sm">
            <SheetHeader>
              <SheetTitle>Menú</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-2">
              {visibleNavItems.map((item) => (
                <Button
                  key={item.label}
                  variant={location.pathname === item.path ? "default" : "ghost"}
                  className="w-full justify-start gap-2"
                  onClick={() => handleNavigate(item.path)}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Button>
              ))}
            </div>
            <div className="mt-6 space-y-2 border-t pt-4">
              <span className="block rounded-md bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                {user?.email || "Operador"}
              </span>
              <span className="block rounded-md bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                {role === "admin" ? "Admin" : "Operador"}
              </span>
              <Button
                className="w-full justify-start gap-2"
                variant="outline"
                onClick={async () => {
                  setMobileMenuOpen(false);
                  await handleSignOut();
                }}
              >
                <LogOut className="h-4 w-4" />
                <span>Salir</span>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
