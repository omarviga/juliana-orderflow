import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bluetooth, Trash2, Plus } from "lucide-react";
import { useBluetootPrinter } from "@/hooks/useBluetootPrinter";

export function PrinterConfig() {
  const [open, setOpen] = useState(false);
  const {
    preferences,
    savePreferences,
    pairClientPrinter,
    pairKitchenPrinter,
    unpairClientPrinter,
    unpairKitchenPrinter,
  } = useBluetootPrinter();

  const handleToggleAutoPrint = () => {
    savePreferences({
      ...preferences,
      autoPrint: !preferences.autoPrint,
    });
  };

  const handleToggleBluetooth = () => {
    savePreferences({
      ...preferences,
      useBluetoothIfAvailable: !preferences.useBluetoothIfAvailable,
    });
  };

  const handleToggleFallback = () => {
    savePreferences({
      ...preferences,
      fallbackToWeb: !preferences.fallbackToWeb,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bluetooth className="h-4 w-4" />
          Impresoras
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Impresoras</DialogTitle>
          <DialogDescription>
            Configura tus impresoras Bluetooth y opciones de impresión
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Impresora 80mm */}
          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Impresora Cliente (80mm)</h3>
                <p className="text-sm text-muted-foreground">Para tickets del cliente</p>
              </div>
              {preferences.clientPrinter80mm && (
                <div className="text-xs rounded-full bg-green-100 px-2 py-1 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  ✓ Conectada
                </div>
              )}
            </div>

            {preferences.clientPrinter80mm ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {preferences.clientPrinter80mm.name}
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-2"
                  onClick={unpairClientPrinter}
                >
                  <Trash2 className="h-4 w-4" />
                  Desemparejar
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={pairClientPrinter}
              >
                <Plus className="h-4 w-4" />
                Emparejar Impresora
              </Button>
            )}
          </div>

          {/* Impresora 58mm */}
          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Impresora Cocina (58mm)</h3>
                <p className="text-sm text-muted-foreground">Para comandas de cocina</p>
              </div>
              {preferences.kitchenPrinter58mm && (
                <div className="text-xs rounded-full bg-green-100 px-2 py-1 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  ✓ Conectada
                </div>
              )}
            </div>

            {preferences.kitchenPrinter58mm ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {preferences.kitchenPrinter58mm.name}
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-2"
                  onClick={unpairKitchenPrinter}
                >
                  <Trash2 className="h-4 w-4" />
                  Desemparejar
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={pairKitchenPrinter}
              >
                <Plus className="h-4 w-4" />
                Emparejar Impresora
              </Button>
            )}
          </div>

          {/* Opciones */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-print" className="font-medium text-foreground">
                Impresión automática
              </Label>
              <Switch
                id="auto-print"
                checked={preferences.autoPrint}
                onCheckedChange={handleToggleAutoPrint}
              />
            </div>

            {preferences.autoPrint && (
              <p className="text-xs text-muted-foreground">
                Se imprimirán ambos tickets automáticamente al confirmar el pago
              </p>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="use-bluetooth" className="font-medium text-foreground">
                Usar Bluetooth
              </Label>
              <Switch
                id="use-bluetooth"
                checked={preferences.useBluetoothIfAvailable}
                onCheckedChange={handleToggleBluetooth}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="fallback" className="font-medium text-foreground">
                Fallback a navegador
              </Label>
              <Switch
                id="fallback"
                checked={preferences.fallbackToWeb}
                onCheckedChange={handleToggleFallback}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
