import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  type CashCutDetails,
  type CashCutCountSummary,
  generateClientTicketHTML,
  generateCashCutTicketHTML,
  generateKitchenOrderHTML,
  printMultipleToDevice,
  printToCups,
  printToDevice,
  printViaBrowser,
} from "@/lib/printer-formats";
import type { PrinterDevice, PrinterPreferences } from "@/types/printer";
import type { CartItem } from "@/types/pos";
import type { CashRegisterSale } from "@/lib/cash-register";

const STORAGE_KEY = "printerPreferences";
const AVAILABLE_PRINTERS_KEY = "availablePrinters";
const CUPS_PRINTER_URL = import.meta.env.VITE_CUPS_PRINTER_URL?.trim();
const DEFAULT_PREFERENCES: PrinterPreferences = {
  printers: {},
  clientPrinterId: undefined,
  kitchenPrinterId: undefined,
  autoPrint: true,
  useBluetoothIfAvailable: true,
  fallbackToWeb: true,
  openDrawerOn80mm: true,
  fullCutOn80mm: true,
};

export function useBluetootPrinter() {
  const [preferences, setPreferences] = useState<PrinterPreferences>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PREFERENCES;

    try {
      const parsed = JSON.parse(stored) as Partial<PrinterPreferences> & {
        clientPrinter80mm?: PrinterDevice;
        kitchenPrinter58mm?: PrinterDevice;
      };
      const migratedPrinters = { ...(parsed.printers || {}) };

      if (parsed.clientPrinter80mm?.address) {
        migratedPrinters[parsed.clientPrinter80mm.address] = {
          id: parsed.clientPrinter80mm.address,
          type: "80mm",
          status: "disconnected",
          ...parsed.clientPrinter80mm,
        };
      }

      if (parsed.kitchenPrinter58mm?.address) {
        migratedPrinters[parsed.kitchenPrinter58mm.address] = {
          id: parsed.kitchenPrinter58mm.address,
          type: "58mm",
          status: "disconnected",
          ...parsed.kitchenPrinter58mm,
        };
      }

      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
        printers: migratedPrinters,
        clientPrinterId:
          parsed.clientPrinterId || parsed.clientPrinter80mm?.address || DEFAULT_PREFERENCES.clientPrinterId,
        kitchenPrinterId:
          parsed.kitchenPrinterId || parsed.kitchenPrinter58mm?.address || DEFAULT_PREFERENCES.kitchenPrinterId,
      };
    } catch {
      return DEFAULT_PREFERENCES;
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
      return [];
    }
  });
  const [isScanning, setIsScanning] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printQueue, setPrintQueue] = useState<Array<() => Promise<void>>>([]);

  // Sincronizar tipos guardados con la lista visible de impresoras.
  useEffect(() => {
    setAvailablePrinters((prev) =>
      prev.map((printer) => {
        const savedPrinter = preferences.printers[printer.address];
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
    setPreferences(prefs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
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
      setPreferences((prev) => {
        const updatedPrinters = { ...prev.printers };

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
    },
    [availablePrinters]
  );

  // Obtener impresora asignada a cliente (80mm)
  const getClientPrinter = useCallback((): PrinterDevice | undefined => {
    return preferences.clientPrinterId
      ? preferences.printers[preferences.clientPrinterId]
      : undefined;
  }, [preferences]);

  // Obtener impresora asignada a cocina (58mm)
  const getKitchenPrinter = useCallback((): PrinterDevice | undefined => {
    return preferences.kitchenPrinterId
      ? preferences.printers[preferences.kitchenPrinterId]
      : undefined;
  }, [preferences]);

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
    assignPrinterType(printer.id, "58mm");
    toast.success(`Impresora "${printer.name}" asignada a cocina`);
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
      if (preferences.useBluetoothIfAvailable) {
        if (!preferredPrinter?.address) {
          if (!preferences.fallbackToWeb) {
            throw new Error("No hay impresora Bluetooth emparejada para esta impresión.");
          }
        } else {
          try {
            await printToDevice(preferredPrinter.address, htmlContent, printerSize, options);
            toast.success(`${title} enviado a impresora Bluetooth`);
            return;
          } catch (error) {
            console.error(`Error al imprimir ${title} por Bluetooth:`, error);
            if (!preferences.fallbackToWeb) {
              throw error;
            }
            toast.warning(`Bluetooth falló. Usando impresión por navegador para ${title}.`);
          }
        }
      }

      if (CUPS_PRINTER_URL) {
        try {
          await printToCups(htmlContent, CUPS_PRINTER_URL);
          toast.success(`${title} enviado a CUPS`);
          return;
        } catch (error) {
          console.error(`Error al imprimir ${title} por CUPS:`, error);
          if (!preferences.fallbackToWeb) {
            throw error;
          }
          toast.warning(`CUPS falló. Usando impresión por navegador para ${title}.`);
        }
      }

      printViaBrowser(htmlContent, title);
      toast.success(`${title} listo para imprimir`);
    },
    [preferences]
  );

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
          const htmlContent = generateClientTicketHTML(
            items,
            total,
            orderNumber,
            customerName,
            dateStr,
            paymentMethodLabel
          );
          await printWithPreferences(
            htmlContent,
            "Ticket Cliente",
            "80mm",
            getClientPrinter(),
            {
              openDrawer: preferences.openDrawerOn80mm,
              fullCut: preferences.fullCutOn80mm,
            }
          );
        } catch (error) {
          console.error("Error al imprimir ticket:", error);
          toast.error("Error al imprimir ticket");
          throw error;
        }
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getClientPrinter, preferences, printWithPreferences]
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
          const htmlContent = generateCashCutTicketHTML(sales, generatedAt, title, countSummary, details);
          await printWithPreferences(
            htmlContent,
            title,
            "80mm",
            getClientPrinter(),
            {
              openDrawer: preferences.openDrawerOn80mm,
              fullCut: preferences.fullCutOn80mm,
            }
          );
        } catch (error) {
          console.error("Error al imprimir corte de caja:", error);
          toast.error("Error al imprimir corte de caja");
          throw error;
        }
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getClientPrinter, preferences, printWithPreferences]
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
          const htmlContent = generateKitchenOrderHTML(
            items,
            orderNumber,
            customerName,
            dateStr
          );
          await printWithPreferences(
            htmlContent,
            "Comanda Cocina",
            "58mm",
            getKitchenPrinter()
          );
        } catch (error) {
          console.error("Error al imprimir comanda:", error);
          toast.error("Error al imprimir comanda");
          throw error;
        }
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getKitchenPrinter, printWithPreferences]
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
        const kitchenHtml = generateKitchenOrderHTML(items, orderNumber, customerName, dateStr);
        const clientHtml = generateClientTicketHTML(
          items,
          total,
          orderNumber,
          customerName,
          dateStr,
          paymentMethodLabel
        );

        if (preferences.useBluetoothIfAvailable) {
          const printer80 = getClientPrinter();
          if (printer80?.address) {
            try {
              await printMultipleToDevice(printer80.address, [
                {
                  htmlContent: kitchenHtml,
                  printerSize: "80mm",
                  options: {
                    openDrawer: false,
                    fullCut: preferences.fullCutOn80mm,
                  },
                },
                {
                  htmlContent: clientHtml,
                  printerSize: "80mm",
                  options: {
                    openDrawer: preferences.openDrawerOn80mm,
                    fullCut: preferences.fullCutOn80mm,
                  },
                },
              ]);
              toast.success("Comanda y ticket enviados en un solo trabajo (80mm)");
              return;
            } catch (error) {
              console.error("Error al imprimir trabajo combinado por Bluetooth:", error);
              if (!preferences.fallbackToWeb) {
                throw error;
              }
              toast.warning("Bluetooth falló. Usando impresión por navegador.");
            }
          } else if (!preferences.fallbackToWeb) {
            throw new Error("No hay impresora 80mm emparejada.");
          }
        }

        const combinedHtml = `${kitchenHtml}
          <div style="page-break-after: always;"></div>
          ${clientHtml}`;
        printViaBrowser(combinedHtml, "Comanda + Ticket");
        toast.success("Comanda y ticket listos para imprimir");
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getClientPrinter, preferences]
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
