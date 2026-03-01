import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  type CashCutDetails,
  type CashCutCountSummary,
  generateClientTicketEscPos,
  generateCashCutTicketEscPos,
  generateKitchenOrderEscPos,
  printMultipleToDevice,
} from "@/lib/printer-formats";
import type { PrinterDevice, PrinterPreferences } from "@/types/printer";
import type { CartItem } from "@/types/pos";
import type { CashRegisterSale } from "@/lib/cash-register";

const STORAGE_KEY = "printerPreferences";
const AVAILABLE_PRINTERS_KEY = "availablePrinters";
const REQUIRE_SERVER_PRINT = false;
const FORCE_80MM_ONLY = true;
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

function enforceServerOnlyPreferences(prefs: PrinterPreferences): PrinterPreferences {
  if (!REQUIRE_SERVER_PRINT) return prefs;
  return {
    ...prefs,
    autoPrint: true,
    useBluetoothIfAvailable: false,
    fallbackToWeb: false,
  };
}

function enforce80mmOnlyPreferences(prefs: PrinterPreferences): PrinterPreferences {
  if (!FORCE_80MM_ONLY) return prefs;
  const normalizedPrinters: Record<string, PrinterDevice> = {};
  Object.entries(prefs.printers || {}).forEach(([id, printer]) => {
    normalizedPrinters[id] = {
      ...printer,
      type: printer.type === "58mm" ? "80mm" : printer.type,
    };
  });
  const clientPrinterId = prefs.clientPrinterId || FIXED_CLIENT_PRINTER_ID;
  return {
    ...prefs,
    printers: normalizedPrinters,
    clientPrinterId,
    kitchenPrinterId: clientPrinterId,
    useBluetoothIfAvailable: true,
    fallbackToWeb: false,
  };
}

function normalizePrinter(
  value: unknown,
  fallbackId?: string
): PrinterDevice | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<PrinterDevice> & Record<string, unknown>;
  const id = typeof raw.id === "string" && raw.id ? raw.id : fallbackId;
  const address =
    typeof raw.address === "string" && raw.address
      ? raw.address
      : id;

  if (!id || !address) return undefined;

  return {
    id,
    address,
    name: typeof raw.name === "string" && raw.name ? raw.name : "Impresora Bluetooth",
    type: raw.type === "80mm" || raw.type === "58mm" ? raw.type : null,
    status:
      raw.status === "connected" || raw.status === "disconnected" || raw.status === "pairing"
        ? raw.status
        : "disconnected",
    lastUsed: raw.lastUsed instanceof Date ? raw.lastUsed : undefined,
  };
}

function normalizePrintersMap(input: unknown): Record<string, PrinterDevice> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const map = input as Record<string, unknown>;
  const normalized: Record<string, PrinterDevice> = {};
  Object.entries(map).forEach(([key, value]) => {
    const printer = normalizePrinter(value, key);
    if (printer) normalized[printer.id] = printer;
  });
  return normalized;
}

export function useBluetootPrinter() {
  const [preferences, setPreferences] = useState<PrinterPreferences>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return enforceServerOnlyPreferences(DEFAULT_PREFERENCES);

    try {
      const parsed = JSON.parse(stored) as Partial<PrinterPreferences> & {
        clientPrinter80mm?: PrinterDevice;
        kitchenPrinter58mm?: PrinterDevice;
      };
      const migratedPrinters = normalizePrintersMap(parsed.printers);

      if (parsed.clientPrinter80mm?.address) {
        migratedPrinters[parsed.clientPrinter80mm.address] = {
          id: parsed.clientPrinter80mm.address,
          address: parsed.clientPrinter80mm.address,
          name: parsed.clientPrinter80mm.name || "Impresora 80mm",
          type: "80mm",
          status: "disconnected",
        };
      }

      if (parsed.kitchenPrinter58mm?.address) {
        migratedPrinters[parsed.kitchenPrinter58mm.address] = {
          id: parsed.kitchenPrinter58mm.address,
          address: parsed.kitchenPrinter58mm.address,
          name: parsed.kitchenPrinter58mm.name || "Impresora 58mm",
          type: "58mm",
          status: "disconnected",
        };
      }

      return enforce80mmOnlyPreferences(enforceServerOnlyPreferences({
        ...DEFAULT_PREFERENCES,
        ...parsed,
        printers: migratedPrinters,
        clientPrinterId:
          parsed.clientPrinterId || parsed.clientPrinter80mm?.address || DEFAULT_PREFERENCES.clientPrinterId,
        kitchenPrinterId:
          parsed.kitchenPrinterId || parsed.kitchenPrinter58mm?.address || DEFAULT_PREFERENCES.kitchenPrinterId,
      }));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return enforce80mmOnlyPreferences(enforceServerOnlyPreferences(DEFAULT_PREFERENCES));
    }
  });

  const [availablePrinters, setAvailablePrinters] = useState<PrinterDevice[]>(() => {
    const saved = localStorage.getItem(AVAILABLE_PRINTERS_KEY);
    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved) as Array<Pick<PrinterDevice, "address" | "name">>;
      return parsed.map((printer) => ({
        address: printer.address,
        name: printer.name,
        id: printer.address,
        type: preferences.printers[printer.address]?.type ?? null,
        status: "disconnected",
      }));
    } catch (error) {
      console.error("Error parsing saved printers:", error);
      localStorage.removeItem(AVAILABLE_PRINTERS_KEY);
      return [];
    }
  });
  const [isScanning, setIsScanning] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printQueue, setPrintQueue] = useState<Array<() => Promise<void>>>([]);
  const openDrawerOn80mm = preferences.openDrawerOn80mm;
  const fullCutOn80mm = preferences.fullCutOn80mm;

  // Sincronizar tipos guardados con la lista visible de impresoras.
  useEffect(() => {
    const printers = normalizePrintersMap(preferences.printers);
    setAvailablePrinters((prev) =>
      prev.map((printer) => {
        const savedPrinter = printers[printer.address];
        if (!savedPrinter) return { ...printer, type: null };
        return {
          ...printer,
          type: savedPrinter.type ?? null,
        };
      })
    );
  }, [preferences.printers]);

  // Persistir listado de impresoras para rehidratacion rapida en UI.
  useEffect(() => {
    if (availablePrinters.length === 0) {
      localStorage.removeItem(AVAILABLE_PRINTERS_KEY);
      return;
    }

    localStorage.setItem(
      AVAILABLE_PRINTERS_KEY,
      JSON.stringify(
        availablePrinters.map((printer) => ({
          address: printer.address,
          name: printer.name,
        }))
      )
    );
  }, [availablePrinters]);

  const enqueuePrintJob = useCallback((job: () => Promise<void>) => {
    return new Promise<void>((resolve, reject) => {
      setPrintQueue((prev) => [
        ...prev,
        async () => {
          try {
            await job();
            resolve();
          } catch (error) {
            reject(error);
            throw error;
          }
        },
      ]);
    });
  }, []);

  // Guardar preferencias
  const savePreferences = useCallback((prefs: PrinterPreferences) => {
    const normalizedPrefsBase: PrinterPreferences = {
      ...DEFAULT_PREFERENCES,
      ...prefs,
      printers: normalizePrintersMap(prefs.printers),
    };
    const normalizedPrefs = enforce80mmOnlyPreferences(enforceServerOnlyPreferences(normalizedPrefsBase));
    setPreferences(normalizedPrefs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedPrefs));
  }, []);

  const resetPrinterStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(AVAILABLE_PRINTERS_KEY);
    setPreferences(enforce80mmOnlyPreferences(enforceServerOnlyPreferences(DEFAULT_PREFERENCES)));
    setAvailablePrinters([]);
  }, []);

  // Escanear impresoras Bluetooth disponibles
  const scanForPrinters = useCallback(async () => {
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

      setPreferences((prev) => {
        if (prev.printers[newPrinter.id]) {
          return prev;
        }
        const newPrefs: PrinterPreferences = {
          ...prev,
          printers: {
            ...prev.printers,
            [newPrinter.id]: newPrinter,
          },
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
        return newPrefs;
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
  }, []);

  // Asignar tipo a una impresora
  const assignPrinterType = useCallback(
    (printerId: string, type: "80mm" | "58mm" | null) => {
      try {
        setPreferences((prev) => {
          const updatedPrinters = { ...normalizePrintersMap(prev.printers) };

          // Crear registro si no existe para evitar estados inconsistentes.
          if (!updatedPrinters[printerId]) {
            const knownPrinter = availablePrinters.find((p) => p.address === printerId);
            updatedPrinters[printerId] = {
              id: printerId,
              address: printerId,
              name: knownPrinter?.name || "Impresora Bluetooth",
              type: null,
              status: "disconnected",
            };
          }

          if (type) {
            Object.keys(updatedPrinters).forEach((key) => {
              if (updatedPrinters[key]?.type === type) {
                updatedPrinters[key] = { ...updatedPrinters[key], type: null };
              }
            });
          }

          updatedPrinters[printerId] = {
            ...updatedPrinters[printerId],
            type,
          };

          const newPrefs: PrinterPreferences = {
            ...prev,
            printers: updatedPrinters,
            clientPrinterId: prev.clientPrinterId,
            kitchenPrinterId: prev.kitchenPrinterId,
          };

          if (type === "80mm") {
            newPrefs.clientPrinterId = printerId;
          } else if (type === "58mm") {
            newPrefs.kitchenPrinterId = printerId;
          } else {
            if (prev.clientPrinterId === printerId) {
              newPrefs.clientPrinterId = undefined;
            }
            if (prev.kitchenPrinterId === printerId) {
              newPrefs.kitchenPrinterId = undefined;
            }
          }

          localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
          return newPrefs;
        });

        setAvailablePrinters((prev) =>
          prev.map((printer) =>
            printer.id === printerId
              ? { ...printer, type }
              : type && printer.type === type
                ? { ...printer, type: null }
                : printer
          )
        );
      } catch (error) {
        console.error("Error al asignar tipo de impresora:", error);
        toast.error("Error al asignar impresora. Repara la configuración e intenta de nuevo.");
      }
    },
    [availablePrinters]
  );

  // Obtener impresora asignada a cliente (80mm)
  const getClientPrinter = useCallback((): PrinterDevice | undefined => {
    if (preferences.clientPrinterId && preferences.printers[preferences.clientPrinterId]) {
      return preferences.printers[preferences.clientPrinterId];
    }
    return FIXED_CLIENT_PRINTER;
  }, [preferences]);

  // Obtener impresora asignada a cocina (58mm)
  const getKitchenPrinter = useCallback((): PrinterDevice | undefined => {
    return getClientPrinter();
  }, [getClientPrinter]);

  // Eliminar impresora
  const removePrinter = useCallback((printerId: string) => {
    setPreferences((prev) => {
      const updatedPrinters = { ...prev.printers };
      delete updatedPrinters[printerId];

      const newPrefs: PrinterPreferences = {
        ...prev,
        printers: updatedPrinters,
      };

      if (prev.clientPrinterId === printerId) {
        newPrefs.clientPrinterId = undefined;
      }
      if (prev.kitchenPrinterId === printerId) {
        newPrefs.kitchenPrinterId = undefined;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
      return newPrefs;
    });

    setAvailablePrinters((prev) => prev.filter((p) => p.id !== printerId));
  }, []);

  // Compatibilidad con UI existente
  const pairClientPrinter = useCallback(async () => {
    const printer = await scanForPrinters();
    if (!printer) return false;
    assignPrinterType(printer.id, "80mm");
    toast.success(`Impresora "${printer.name}" asignada a cliente`);
    return true;
  }, [assignPrinterType, scanForPrinters]);

  const pairKitchenPrinter = useCallback(async () => {
    const printer = await scanForPrinters();
    if (!printer) return false;
    assignPrinterType(printer.id, "80mm");
    toast.success(`Impresora "${printer.name}" asignada a cocina (80mm)`);
    return true;
  }, [assignPrinterType, scanForPrinters]);

  // Procesar cola de impresión
  useEffect(() => {
    let isMounted = true;

    const processPrintQueue = async () => {
      if (printQueue.length === 0 || isPrinting) return;

      setIsPrinting(true);
      const job = printQueue[0];

      try {
        await job();
      } catch (error) {
        console.error("Error en trabajo de impresión:", error);
      } finally {
        if (isMounted) {
          setPrintQueue((prev) => prev.slice(1));
          setIsPrinting(false);
        }
      }
    };

    processPrintQueue();

    return () => {
      isMounted = false;
    };
  }, [printQueue, isPrinting]);

  // Imprimir ticket del cliente
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
          if (!clientPrinter?.address) {
            throw new Error("No hay impresora Bluetooth 80mm configurada.");
          }

          const escPosCommands = generateClientTicketEscPos(
            items,
            total,
            orderNumber,
            customerName,
            dateStr,
            paymentMethodLabel,
            {
                openDrawer: openDrawerOn80mm,
                fullCut: fullCutOn80mm,
              }
            );

          await printMultipleToDevice(clientPrinter.address, [
            {
              escPosCommands,
              printerSize: "80mm",
              options: {
                openDrawer: openDrawerOn80mm,
                fullCut: fullCutOn80mm,
              },
            },
          ]);
          toast.success("Ticket de cliente enviado a impresora");
        } catch (error) {
          console.error("Error al imprimir ticket:", error);
          toast.error("Error al imprimir ticket");
          throw error;
        }
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getClientPrinter, fullCutOn80mm, openDrawerOn80mm]
  );

  const printCashCutTicket = useCallback(
    async (
      sales: CashRegisterSale[],
      generatedAt: string,
      title: string = "CORTE DE CAJA",
      countSummary?: CashCutCountSummary,
      details?: CashCutDetails
    ) => {
      const printJob = async () => {
        try {
          const clientPrinter = getClientPrinter();
          if (!clientPrinter?.address) {
            throw new Error("No hay impresora Bluetooth 80mm configurada.");
          }
          const escPosCommands = generateCashCutTicketEscPos(
            sales,
            generatedAt,
            title,
            countSummary,
            details,
            {
              openDrawer: openDrawerOn80mm,
              fullCut: fullCutOn80mm,
            }
          );
          await printMultipleToDevice(clientPrinter.address, [
            {
              escPosCommands,
              printerSize: "80mm",
              options: {
                openDrawer: openDrawerOn80mm,
                fullCut: fullCutOn80mm,
              },
            },
          ]);
        } catch (error) {
          console.error("Error al imprimir corte de caja:", error);
          toast.error("Error al imprimir corte de caja");
          throw error;
        }
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getClientPrinter, fullCutOn80mm, openDrawerOn80mm]
  );

  // Imprimir comanda de cocina
  const printKitchenOrder = useCallback(
    async (
      items: CartItem[],
      orderNumber: number | null,
      customerName: string,
      dateStr: string
    ) => {
      const printJob = async () => {
        try {
          const clientPrinter = getClientPrinter();
          const printerSize = "80mm" as const;
          if (!clientPrinter?.address) {
            throw new Error("No hay impresora Bluetooth 80mm configurada.");
          }

          const escPosCommands = generateKitchenOrderEscPos(
            items,
            orderNumber,
            customerName,
            dateStr
          );

          await printMultipleToDevice(clientPrinter.address, [
            {
              escPosCommands,
              printerSize,
            },
          ]);
          toast.success("Comanda de cocina enviada a impresora");
        } catch (error) {
          console.error("Error al imprimir comanda:", error);
          toast.error("Error al imprimir comanda");
          throw error;
        }
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getClientPrinter]
  );

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
        const clientP = clientPrinter?.address ? clientPrinter : undefined;
        if (!clientP) {
          throw new Error("No hay impresora Bluetooth 80mm configurada.");
        }

        const kitchenEscPos = generateKitchenOrderEscPos(items, orderNumber, customerName, dateStr);
        const clientEscPos = generateClientTicketEscPos(
          items,
          total,
          orderNumber,
          customerName,
          dateStr,
          paymentMethodLabel,
          { openDrawer: openDrawerOn80mm, fullCut: fullCutOn80mm }
        );

        await printMultipleToDevice(clientP.address, [
          { escPosCommands: kitchenEscPos, printerSize: "80mm" },
          { escPosCommands: clientEscPos, printerSize: "80mm" },
        ]);
        toast.success("Comanda y ticket enviados a impresora 80mm");
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getClientPrinter, fullCutOn80mm, openDrawerOn80mm]
  );

  // Imprimir ambos documentos (cliente y cocina)
  const printBoth = useCallback(
    async (
      items: CartItem[],
      total: number,
      orderNumber: number | null,
      customerName: string,
      dateStr: string,
      paymentMethodLabel: string = "Efectivo"
    ) => {
      await printKitchenAndClientCombined(
        items,
        total,
        orderNumber,
        customerName,
        dateStr,
        paymentMethodLabel
      );
    },
    [printKitchenAndClientCombined]
  );

  // Desemparejar impresora 80mm
  const unpairClientPrinter = useCallback(() => {
    const printerId = preferences.clientPrinterId;
    if (!printerId) return;

    const updatedPrinters = { ...preferences.printers };
    if (updatedPrinters[printerId]) {
      updatedPrinters[printerId] = { ...updatedPrinters[printerId], type: null };
    }
    const newPrefs: PrinterPreferences = {
      ...preferences,
      printers: updatedPrinters,
      clientPrinterId: undefined,
    };
    savePreferences(newPrefs);
    toast.success("Impresora 80mm desemparejada");
  }, [preferences, savePreferences]);

  // Desemparejar impresora 58mm
  const unpairKitchenPrinter = useCallback(() => {
    const printerId = preferences.kitchenPrinterId;
    if (!printerId) return;

    const updatedPrinters = { ...preferences.printers };
    if (updatedPrinters[printerId]) {
      updatedPrinters[printerId] = { ...updatedPrinters[printerId], type: null };
    }
    const newPrefs: PrinterPreferences = {
      ...preferences,
      printers: updatedPrinters,
      kitchenPrinterId: undefined,
    };
    savePreferences(newPrefs);
    toast.success("Impresora 58mm desemparejada");
  }, [preferences, savePreferences]);

  return {
    preferences,
    availablePrinters,
    isScanning,
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
