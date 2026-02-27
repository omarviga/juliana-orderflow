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
import type { CartItem } from "@/types/pos";
import type { CashRegisterSale } from "@/lib/cash-register";

interface PrinterDevice {
  address: string;
  name: string;
  lastUsed?: Date;
}

interface PrinterPreferences {
  clientPrinter80mm?: PrinterDevice;
  kitchenPrinter58mm?: PrinterDevice;
  autoPrint: boolean;
  useBluetoothIfAvailable: boolean;
  fallbackToWeb: boolean;
  openDrawerOn80mm: boolean;
  fullCutOn80mm: boolean;
}

const STORAGE_KEY = "printerPreferences";
const CUPS_PRINTER_URL = import.meta.env.VITE_CUPS_PRINTER_URL?.trim();
const DEFAULT_PREFERENCES: PrinterPreferences = {
  autoPrint: true,
  useBluetoothIfAvailable: false,
  fallbackToWeb: true,
  openDrawerOn80mm: true,
  fullCutOn80mm: true,
};

export function useBluetootPrinter() {
  const [preferences, setPreferences] = useState<PrinterPreferences>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PREFERENCES;

    try {
      const parsed = JSON.parse(stored) as Partial<PrinterPreferences>;
      return { ...DEFAULT_PREFERENCES, ...parsed };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  const [isPrinting, setIsPrinting] = useState(false);
  const [printQueue, setPrintQueue] = useState<Array<() => Promise<void>>>([]);

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

  // Emparejar impresora 80mm (cliente)
  const pairClientPrinter = useCallback(async () => {
    try {
      if (!navigator.bluetooth) {
        toast.error("Web Bluetooth no disponible en este navegador");
        return false;
      }

      toast.loading("Buscando impresoras...");

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ["00001101-0000-1000-8000-00805f9b34fb"] }],
        optionalServices: ["00001101-0000-1000-8000-00805f9b34fb", "0000180a-0000-1000-8000-00805f9b34fb"],
      });

      if (!device) return false;

      const newPrefs = {
        ...preferences,
        clientPrinter80mm: {
          address: device.id,
          name: device.name || "Impresora 80mm",
        },
      };

      savePreferences(newPrefs);
      toast.success(`Impresora "${device.name}" emparejada correctamente`);
      return true;
    } catch (error) {
      console.error("Error al emparejar impresora:", error);
      if (error instanceof Error) {
        if (error.message.includes("User cancelled")) {
          toast.info("Emparejamiento cancelado");
        } else if (error.message.includes("NotFoundError")) {
          toast.error("No se encontraron impresoras. Verifica que esté encendida");
        } else if (error.message.includes("NotAllowedError")) {
          toast.error("Permiso denegado. Revisa los permisos de Bluetooth");
        } else {
          toast.error(`Error: ${error.message}`);
        }
      } else {
        toast.error("Error desconocido al emparejar impresora");
      }
      return false;
    }
  }, [preferences, savePreferences]);

  // Emparejar impresora 58mm (cocina)
  const pairKitchenPrinter = useCallback(async () => {
    try {
      if (!navigator.bluetooth) {
        toast.error("Web Bluetooth no disponible en este navegador");
        return false;
      }

      toast.loading("Buscando impresoras...");

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ["00001101-0000-1000-8000-00805f9b34fb"] }],
        optionalServices: ["00001101-0000-1000-8000-00805f9b34fb", "0000180a-0000-1000-8000-00805f9b34fb"],
      });

      if (!device) return false;

      const newPrefs = {
        ...preferences,
        kitchenPrinter58mm: {
          address: device.id,
          name: device.name || "Impresora 58mm",
        },
      };

      savePreferences(newPrefs);
      toast.success(`Impresora "${device.name}" emparejada correctamente`);
      return true;
    } catch (error) {
      console.error("Error al emparejar impresora:", error);
      if (error instanceof Error) {
        if (error.message.includes("User cancelled")) {
          toast.info("Emparejamiento cancelado");
        } else if (error.message.includes("NotFoundError")) {
          toast.error("No se encontraron impresoras. Verifica que esté encendida");
        } else if (error.message.includes("NotAllowedError")) {
          toast.error("Permiso denegado. Revisa los permisos de Bluetooth");
        } else {
          toast.error(`Error: ${error.message}`);
        }
      } else {
        toast.error("Error desconocido al emparejar impresora");
      }
      return false;
    }
  }, [preferences, savePreferences]);

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
            preferences.clientPrinter80mm,
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
    [enqueuePrintJob, preferences, printWithPreferences]
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
            preferences.clientPrinter80mm,
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
    [enqueuePrintJob, preferences, printWithPreferences]
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
            "80mm",
            preferences.clientPrinter80mm
          );
        } catch (error) {
          console.error("Error al imprimir comanda:", error);
          toast.error("Error al imprimir comanda");
          throw error;
        }
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, preferences, printWithPreferences]
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
          const printer80 = preferences.clientPrinter80mm;
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
    [enqueuePrintJob, preferences]
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
    const newPrefs = { ...preferences, clientPrinter80mm: undefined };
    savePreferences(newPrefs);
    toast.success("Impresora 80mm desemparejada");
  }, [preferences, savePreferences]);

  // Desemparejar impresora 58mm
  const unpairKitchenPrinter = useCallback(() => {
    const newPrefs = { ...preferences, kitchenPrinter58mm: undefined };
    savePreferences(newPrefs);
    toast.success("Impresora 58mm desemparejada");
  }, [preferences, savePreferences]);

  return {
    preferences,
    savePreferences,
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
