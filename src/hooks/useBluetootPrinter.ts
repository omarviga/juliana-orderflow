// printer-hook.ts (adaptado)
import {
  printClientTicketEscPos,
  printKitchenOrderEscPos,
  printBothEscPos,
} from "@/lib/printer-format";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  type CashCutDetails,
  type CashCutCountSummary,
  generateClientTicketHTML,
  generateClientTicketEscPos,
  generateCashCutTicketHTML,
  generateKitchenOrderHTML,
  generateKitchenOrderEscPos,
  printMultipleToDevice,
  printToDevice,
  buildEscPosAppUrl, // Nuevo import
  type PrintPayload, // Nuevo import
  isEscPosAppAvailable, // Nuevo import
} from "@/lib/printer-formats";
import type { PrinterDevice, PrinterPreferences } from "@/types/printer";
import type { CartItem } from "@/types/pos";
import type { CashRegisterSale } from "@/lib/cash-register";

const success = await printClientTicketEscPos(
  "00:11:22:33:44:55", // MAC de la impresora
  items,
  total,
  orderNumber,
  customerName,
  dateStr,
  "Efectivo",
  { openDrawer: true, fullCut: true, drawerNumber: 2 }
);

const STORAGE_KEY = "printerPreferences";
const AVAILABLE_PRINTERS_KEY = "availablePrinters";
const FORCE_ESC_POS_ONLY = true;
const FIXED_CLIENT_PRINTER_ID = "GLPrinter_80mm";
const FIXED_KITCHEN_PRINTER_ID = "GLPrinter_80mm";
const FIXED_CLIENT_PRINTER: PrinterDevice = {
  id: FIXED_CLIENT_PRINTER_ID,
  address: FIXED_CLIENT_PRINTER_ID,
  name: "GLPrinter_80mm",
  type: "80mm",
  status: "connected",
};
const FIXED_KITCHEN_PRINTER: PrinterDevice = {
  id: FIXED_KITCHEN_PRINTER_ID,
  address: FIXED_KITCHEN_PRINTER_ID,
  name: "GLPrinter_80mm",
  type: "80mm",
  status: "connected",
};
const DEFAULT_PREFERENCES: PrinterPreferences = {
  printers: {},
  clientPrinterId: FIXED_CLIENT_PRINTER_ID,
  kitchenPrinterId: FIXED_KITCHEN_PRINTER_ID,
  autoPrint: true,
  useBluetoothIfAvailable: true,
  fallbackToWeb: false,
  openDrawerOn80mm: true,
  fullCutOn80mm: true,
};

// Cache para evitar múltiples detecciones
let escPosAppAvailableCache: boolean | null = null;

async function detectEscPosApp(): Promise<boolean> {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;

  if (escPosAppAvailableCache !== null) {
    return escPosAppAvailableCache;
  }

  const isAndroid = /android/i.test(navigator.userAgent);
  if (!isAndroid) {
    escPosAppAvailableCache = false;
    return false;
  }

  try {
    escPosAppAvailableCache = await isEscPosAppAvailable();
    return escPosAppAvailableCache;
  } catch {
    escPosAppAvailableCache = false;
    return false;
  }
}

function enforceServerOnlyPreferences(prefs: PrinterPreferences): PrinterPreferences {
  if (!FORCE_ESC_POS_ONLY) return prefs;
  return {
    ...prefs,
    autoPrint: true,
    useBluetoothIfAvailable: true,
    fallbackToWeb: false,
  };
}

// ... (mantener funciones normalizePrinter, normalizePrintersMap igual)

export function useBluetootPrinter() {
  const [preferences, setPreferences] = useState<PrinterPreferences>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return enforceServerOnlyPreferences(DEFAULT_PREFERENCES);
    // ... (mantener lógica de parsing igual)
    return enforceServerOnlyPreferences(DEFAULT_PREFERENCES);
  });

  const [availablePrinters, setAvailablePrinters] = useState<PrinterDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printQueue, setPrintQueue] = useState<Array<() => Promise<void>>>([]);
  const [useEscPosApp, setUseEscPosApp] = useState(false);

  // Detectar app ESC/POS al iniciar
  useEffect(() => {
    detectEscPosApp().then(setUseEscPosApp);
  }, []);

  // Función para imprimir usando la app ESC/POS
  const printWithEscPosApp = useCallback(async (
    macAddress: string,
    payload: PrintPayload
  ): Promise<boolean> => {
    try {
      const url = buildEscPosAppUrl(macAddress, payload);

      // Intentar abrir la app
      window.location.href = url;

      // Mostrar instrucciones si la app no abre
      setTimeout(() => {
        toast.info("Si la app no se abre, asegúrate de tener ESC/POS PrintService instalada");
      }, 1000);

      return true;
    } catch (error) {
      console.error("Error al abrir app ESC/POS:", error);
      toast.error("Error al abrir la app de impresión");
      return false;
    }
  }, []);

  // Modificar printClientTicket para usar app ESC/POS
  const printClientTicket = useCallback(
    async (
      items: CartItem[],
      total: number,
      orderNumber: number | null,
      customerName: string,
      dateStr: string,
      paymentMethodLabel: string = "Efectivo"
    ) => {
      const printJob = async () => {
        try {
          const clientPrinter = getClientPrinter();

          // Si estamos en Android con app ESC/POS
          if (useEscPosApp && clientPrinter?.address) {
            const escPosCommands = generateClientTicketEscPos(
              items,
              total,
              orderNumber,
              customerName,
              dateStr,
              paymentMethodLabel,
              {
                openDrawer: preferences.openDrawerOn80mm,
                fullCut: preferences.fullCutOn80mm,
              }
            );

            const payload: PrintPayload = {
              commands: escPosCommands,
              config: {
                feedLines: 2,
                autoCut: preferences.fullCutOn80mm ? 'full' : 'partial',
                cashDrawer: preferences.openDrawerOn80mm ? {
                  drawerNumber: 2, // Cajón 2 como configuraste
                  pulseOn: 50,
                  pulseOff: 250
                } : undefined,
                dpi: 203,
                disconnectDelay: 2
              }
            };

            const success = await printWithEscPosApp(clientPrinter.address, payload);

            if (success) {
              toast.success("Ticket enviado a app ESC/POS");
            } else {
              throw new Error("No se pudo abrir la app ESC/POS");
            }
          }
          // Fallback a Bluetooth Web solo si no hay app
          else if (clientPrinter?.address && !useEscPosApp) {
            const escPosCommands = generateClientTicketEscPos(
              items,
              total,
              orderNumber,
              customerName,
              dateStr,
              paymentMethodLabel,
              {
                openDrawer: preferences.openDrawerOn80mm,
                fullCut: preferences.fullCutOn80mm,
              }
            );

            await printMultipleToDevice(clientPrinter.address, [
              {
                escPosCommands,
                printerSize: "80mm",
                options: {
                  openDrawer: preferences.openDrawerOn80mm,
                  fullCut: preferences.fullCutOn80mm,
                },
              },
            ]);
            toast.success("Ticket de cliente enviado a impresora Bluetooth");
          } else {
            throw new Error("No hay impresora configurada");
          }
        } catch (error) {
          console.error("Error al imprimir ticket:", error);
          toast.error("Error al imprimir ticket");
          throw error;
        }
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getClientPrinter, preferences, printWithEscPosApp, useEscPosApp]
  );

  // Modificar printKitchenOrder para usar app ESC/POS
  const printKitchenOrder = useCallback(
    async (
      items: CartItem[],
      orderNumber: number | null,
      customerName: string,
      dateStr: string
    ) => {
      const printJob = async () => {
        try {
          const kitchenPrinter = getKitchenPrinter();
          const printerSize = kitchenPrinter?.type || "58mm";

          // Si estamos en Android con app ESC/POS
          if (useEscPosApp && kitchenPrinter?.address) {
            const escPosCommands = generateKitchenOrderEscPos(
              items,
              orderNumber,
              customerName,
              dateStr
            );

            const payload: PrintPayload = {
              commands: escPosCommands,
              config: {
                feedLines: 2,
                autoCut: 'full',
                dpi: 203,
                disconnectDelay: 2
              }
            };

            const success = await printWithEscPosApp(kitchenPrinter.address, payload);

            if (success) {
              toast.success("Comanda enviada a app ESC/POS");
            } else {
              throw new Error("No se pudo abrir la app ESC/POS");
            }
          }
          // Fallback a Bluetooth Web solo si no hay app
          else if (kitchenPrinter?.address && !useEscPosApp) {
            const escPosCommands = generateKitchenOrderEscPos(
              items,
              orderNumber,
              customerName,
              dateStr
            );

            await printMultipleToDevice(kitchenPrinter.address, [
              {
                escPosCommands,
                printerSize,
              },
            ]);
            toast.success("Comanda de cocina enviada a impresora Bluetooth");
          } else {
            throw new Error("No hay impresora configurada");
          }
        } catch (error) {
          console.error("Error al imprimir comanda:", error);
          toast.error("Error al imprimir comanda");
          throw error;
        }
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getKitchenPrinter, printWithEscPosApp, useEscPosApp]
  );

  // Modificar printKitchenAndClientCombined para usar app ESC/POS
  const printKitchenAndClientCombined = useCallback(
    async (
      items: CartItem[],
      total: number,
      orderNumber: number | null,
      customerName: string,
      dateStr: string,
      paymentMethodLabel: string = "Efectivo"
    ) => {
      const printJob = async () => {
        const clientPrinter = getClientPrinter();

        // Si estamos en Android con app ESC/POS
        if (useEscPosApp && clientPrinter?.address) {
          const kitchenCommands = generateKitchenOrderEscPos(
            items,
            orderNumber,
            customerName,
            dateStr
          );

          const clientCommands = generateClientTicketEscPos(
            items,
            total,
            orderNumber,
            customerName,
            dateStr,
            paymentMethodLabel,
            {
              openDrawer: preferences.openDrawerOn80mm,
              fullCut: preferences.fullCutOn80mm,
            }
          );

          // Combinar comandos (kitchen + client)
          const combinedCommands = new Uint8Array([
            ...kitchenCommands,
            ...clientCommands
          ]);

          const payload: PrintPayload = {
            commands: combinedCommands,
            config: {
              feedLines: 2,
              autoCut: preferences.fullCutOn80mm ? 'full' : 'partial',
              cashDrawer: preferences.openDrawerOn80mm ? {
                drawerNumber: 2,
                pulseOn: 50,
                pulseOff: 250
              } : undefined,
              dpi: 203,
              disconnectDelay: 2
            }
          };

          const success = await printWithEscPosApp(clientPrinter.address, payload);

          if (success) {
            toast.success("Comanda y ticket enviados a app ESC/POS");
            return;
          }
        }

        // Fallback a Bluetooth Web solo si no hay app
        if (!useEscPosApp && preferences.useBluetoothIfAvailable) {
          const kitchenP = getKitchenPrinter();
          const clientP = getClientPrinter();

          if (kitchenP && clientP && kitchenP.address === clientP.address) {
            try {
              const kitchenEscPos = generateKitchenOrderEscPos(items, orderNumber, customerName, dateStr);
              const clientEscPos = generateClientTicketEscPos(
                items,
                total,
                orderNumber,
                customerName,
                dateStr,
                paymentMethodLabel,
                { openDrawer: preferences.openDrawerOn80mm, fullCut: preferences.fullCutOn80mm }
              );

              await printMultipleToDevice(clientP.address, [
                { escPosCommands: kitchenEscPos, printerSize: clientP.type || "80mm" },
                { escPosCommands: clientEscPos, printerSize: clientP.type || "80mm" },
              ]);
              toast.success("Comanda y ticket enviados a la misma impresora");
              return;
            } catch (error) {
              console.error("Error imprimiendo en combo:", error);
            }
          }
        }

        throw new Error("No se pudo imprimir. Verifica la configuración.");
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getClientPrinter, getKitchenPrinter, preferences, printWithEscPosApp, useEscPosApp]
  );

  // Modificar scanForPrinters para mostrar advertencia en Android con app
  const scanForPrinters = useCallback(async () => {
    if (useEscPosApp) {
      toast.warning(
        "En Android con app ESC/POS, usa la dirección MAC directamente. " +
        "El escaneo Bluetooth solo es necesario para Web Bluetooth."
      );

      // En lugar de escanear, mostrar input para MAC
      const mac = prompt("Ingresa la dirección MAC de la impresora (00:11:22:33:44:55):");
      if (mac && /^([0-9A-Fa-f]{2}[:]){5}([0-9A-Fa-f]{2})$/.test(mac)) {
        const newPrinter: PrinterDevice = {
          address: mac,
          name: `Impresora ESC/POS (${mac})`,
          id: mac,
          type: null,
          status: "connected",
          lastUsed: new Date(),
        };

        setAvailablePrinters((prev) => {
          const exists = prev.some((p) => p.address === mac);
          if (exists) return prev;
          return [...prev, newPrinter];
        });

        return newPrinter;
      }
      return undefined;
    }

    // Escaneo Bluetooth normal si no hay app
    if (!navigator.bluetooth) {
      toast.error("Web Bluetooth no disponible");
      return undefined;
    }

    setIsScanning(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["00001101-0000-1000-8000-00805f9b34fb"],
      });

      const newPrinter: PrinterDevice = {
        address: device.id,
        name: device.name || "Impresora Bluetooth",
        id: device.id,
        type: null,
        status: "disconnected",
        lastUsed: new Date(),
      };

      setAvailablePrinters((prev) => {
        const exists = prev.some((p) => p.address === device.id);
        if (exists) return prev;
        return [...prev, newPrinter];
      });

      return newPrinter;
    } catch (error) {
      if (error instanceof Error && !error.message.includes("User cancelled")) {
        console.error("Error scanning:", error);
        toast.error("Error al escanear impresoras");
      }
      return undefined;
    } finally {
      setIsScanning(false);
    }
  }, [useEscPosApp]);

  // Modificar printWithPreferences para deshabilitar HTML cuando hay app
  const printWithPreferences = useCallback(
    async (
      htmlContent: string,
      title: string,
      printerSize: "80mm" | "58mm",
      preferredPrinter?: PrinterDevice,
      options?: {
        openDrawer?: boolean;
        fullCut?: boolean;
      }
    ) => {
      if (useEscPosApp) {
        throw new Error("En modo Android con app, usa printWithEscPosApp en lugar de HTML");
      }

      if (!preferences.useBluetoothIfAvailable) {
        throw new Error("La impresión por ESC/POS Bluetooth es obligatoria en esta instalación.");
      }

      if (!preferredPrinter?.address) {
        throw new Error("No hay impresora Bluetooth emparejada para esta impresión.");
      }

      await printToDevice(preferredPrinter.address, htmlContent, printerSize, options);
      toast.success(`${title} enviado a impresora Bluetooth`);
    },
    [preferences, useEscPosApp]
  );

  // ... (mantener el resto de funciones igual: pairClientPrinter, pairKitchenPrinter, etc.)

  return {
    preferences,
    availablePrinters,
    isScanning,
    useEscPosApp, // Nuevo: indica si estamos usando la app Android
    savePreferences,
    scanForPrinters,
    assignPrinterType,
    getClientPrinter,
    getKitchenPrinter,
    removePrinter,
    resetPrinterStorage,
    pairClientPrinter,
    pairKitchenPrinter,
    unpairClientPrinter,
    unpairKitchenPrinter,
    printClientTicket,
    printCashCutTicket,
    printKitchenOrder,
    printKitchenAndClientCombined,
    printBoth,
    isPrinting,
    queueLength: printQueue.length,
  };
}