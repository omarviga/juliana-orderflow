import { useCallback, useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bluetooth, Printer, RefreshCw, TestTube, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBluetootPrinter } from "@/hooks/useBluetootPrinter";
import { printToCups, printToDevice, printViaBrowser } from "@/lib/printer-formats";
import type { PrinterDevice } from "@/types/printer";

const CUPS_PRINTER_URL = import.meta.env.VITE_CUPS_PRINTER_URL?.trim();

export function PrinterConfig() {
  const [open, setOpen] = useState(false);
  const {
    preferences,
    availablePrinters,
    isScanning,
    scanForPrinters,
    assignPrinterType,
    getClientPrinter,
    getKitchenPrinter,
    removePrinter,
    savePreferences,
  } = useBluetootPrinter();

  const clientPrinter = getClientPrinter();
  const kitchenPrinter = getKitchenPrinter();

  useEffect(() => {
    if (open) {
      void scanForPrinters();
    }
  }, [open, scanForPrinters]);

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

  const handleToggleOpenDrawer80mm = () => {
    savePreferences({
      ...preferences,
      openDrawerOn80mm: !preferences.openDrawerOn80mm,
    });
  };

  const handleToggleFullCut80mm = () => {
    savePreferences({
      ...preferences,
      fullCutOn80mm: !preferences.fullCutOn80mm,
    });
  };

  const testPrinter = useCallback(
    async (printer: PrinterDevice) => {
      if (!printer.type) {
        toast.error("Asigna un tipo a la impresora primero");
        return;
      }

      const testHtml = `
        <div style="text-align: center; font-family: monospace;">
          <h3>PRUEBA DE IMPRESION</h3>
          <hr />
          <p><strong>Impresora:</strong> ${printer.name}</p>
          <p><strong>Tipo:</strong> ${printer.type === "80mm" ? "Cliente (80mm)" : "Cocina (58mm)"}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
          <hr />
          <p>Texto normal</p>
          <p><strong>Texto en negrita</strong></p>
          <p style="text-align: right;">Alineado derecha</p>
          <hr />
          <p>Prueba enviada</p>
        </div>
      `;

      const toastId = toast.loading(`Probando ${printer.name}...`);

      try {
        if (preferences.useBluetoothIfAvailable) {
          try {
            await printToDevice(printer.address, testHtml, printer.type, {
              openDrawer: printer.type === "80mm" ? preferences.openDrawerOn80mm : false,
              fullCut: true,
            });
            toast.success(`Prueba enviada a ${printer.name}`, { id: toastId });
            return;
          } catch (error) {
            console.error("Error de prueba por Bluetooth:", error);
            if (!preferences.fallbackToWeb && !CUPS_PRINTER_URL) {
              throw error;
            }
          }
        }

        if (CUPS_PRINTER_URL) {
          try {
            await printToCups(testHtml, CUPS_PRINTER_URL);
            toast.success(`Prueba enviada a ${printer.name}`, { id: toastId });
            return;
          } catch (error) {
            console.error("Error de prueba por CUPS:", error);
            if (!preferences.fallbackToWeb) {
              throw error;
            }
          }
        }

        printViaBrowser(testHtml, `Prueba ${printer.name}`);
        toast.success(`Prueba enviada a ${printer.name}`, { id: toastId });
      } catch (error) {
        console.error("Error en prueba:", error);
        toast.error(
          `Error: ${error instanceof Error ? error.message : "Desconocido"}`,
          { id: toastId }
        );
      }
    },
    [preferences]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Bluetooth className="h-4 w-4" />
          Impresoras
          {(clientPrinter || kitchenPrinter) && (
            <span className="ml-1 h-2 w-2 rounded-full bg-green-500" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar Impresoras</DialogTitle>
          <DialogDescription>
            Escanea y configura tus impresoras Bluetooth
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Impresoras disponibles</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void scanForPrinters()}
              disabled={isScanning}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`} />
              {isScanning ? "Escaneando..." : "Escanear"}
            </Button>
          </div>

          <div className="space-y-2">
            {availablePrinters.length === 0 && !isScanning && (
              <div className="py-8 text-center text-muted-foreground">
                <Printer className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>No se encontraron impresoras</p>
                <p className="text-sm">Asegurate de que esten encendidas y en modo pairing</p>
              </div>
            )}

            {availablePrinters.map((printer) => (
              <div
                key={printer.address}
                className="flex items-start gap-4 rounded-lg border bg-card p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    <span className="font-medium">{printer.name}</span>
                    {printer.type && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs">
                        {printer.type === "80mm" ? "Cliente" : "Cocina"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{printer.address}</p>

                  <div className="mt-2 flex items-center gap-2">
                    <Select
                      value={printer.type ?? "none"}
                      onValueChange={(value) =>
                        assignPrinterType(
                          printer.address,
                          value === "none" ? null : (value as "80mm" | "58mm")
                        )
                      }
                    >
                      <SelectTrigger className="h-8 w-[180px] text-xs">
                        <SelectValue placeholder="Asignar como..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="80mm">Cliente (80mm)</SelectItem>
                        <SelectItem value="58mm">Cocina (58mm)</SelectItem>
                        <SelectItem value="none">Sin asignar</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => void testPrinter(printer)}
                      disabled={!printer.type}
                      title={!printer.type ? "Asigna un tipo primero" : "Probar impresion"}
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => removePrinter(printer.address)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {(clientPrinter || kitchenPrinter) && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <h4 className="mb-2 text-sm font-medium">Asignaciones actuales</h4>
              <div className="space-y-2 text-sm">
                {clientPrinter && (
                  <div className="flex items-center justify-between">
                    <span>Cliente (80mm):</span>
                    <span className="font-mono text-xs">{clientPrinter.name}</span>
                  </div>
                )}
                {kitchenPrinter && (
                  <div className="flex items-center justify-between">
                    <span>Cocina (58mm):</span>
                    <span className="font-mono text-xs">{kitchenPrinter.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4 border-t pt-4">
            <h4 className="text-sm font-medium">Opciones de impresion</h4>

            <div className="flex items-center justify-between">
              <Label htmlFor="auto-print" className="font-medium">
                Impresión automática
              </Label>
              <Switch
                id="auto-print"
                checked={preferences.autoPrint}
                onCheckedChange={handleToggleAutoPrint}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="use-bluetooth" className="font-medium">
                Usar Bluetooth
              </Label>
              <Switch
                id="use-bluetooth"
                checked={preferences.useBluetoothIfAvailable}
                onCheckedChange={handleToggleBluetooth}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="fallback" className="font-medium">
                Fallback a navegador
              </Label>
              <Switch
                id="fallback"
                checked={preferences.fallbackToWeb}
                onCheckedChange={handleToggleFallback}
              />
            </div>

            {clientPrinter && (
              <>
                <div className="flex items-center justify-between">
                  <Label htmlFor="open-drawer-80" className="font-medium">
                    Abrir cajon en 80mm
                  </Label>
                  <Switch
                    id="open-drawer-80"
                    checked={preferences.openDrawerOn80mm}
                    onCheckedChange={handleToggleOpenDrawer80mm}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="full-cut-80" className="font-medium">
                    Corte completo en 80mm
                  </Label>
                  <Switch
                    id="full-cut-80"
                    checked={preferences.fullCutOn80mm}
                    onCheckedChange={handleToggleFullCut80mm}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
