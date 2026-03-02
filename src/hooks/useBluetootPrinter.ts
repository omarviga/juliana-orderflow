import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type CashCutCountSummary,
  type CashCutDetails,
  generateCashCutTicketEscPos,
  generateClientTicketEscPos,
  generateKitchenOrderEscPos,
  keepBluetoothPrinterAlive,
  printMultipleToDevice,
} from "@/lib/printer-formats";
import type { PrinterDevice, PrinterPreferences } from "@/types/printer";
import type { CartItem } from "@/types/pos";
import type { CashRegisterSale } from "@/lib/cash-register";

const STORAGE_KEY = "printerPreferences";
const AUTO_PRINTER_ID = "AUTO_PRINTER";
const FIXED_PRINTER_ID = "FIXED_GL_PRINTER";
const FIXED_PRINTER_ADDRESS = "AB:0A:FA:8F:3C:AA";
const AUTO_PRINTER: PrinterDevice = {
  id: AUTO_PRINTER_ID,
  address: AUTO_PRINTER_ID,
  name: "Auto (detectar impresora)",
  type: "80mm",
  status: "connected",
};
const FIXED_PRINTER: PrinterDevice = {
  id: FIXED_PRINTER_ID,
  address: FIXED_PRINTER_ADDRESS,
  name: "GL Printer fija",
  type: "80mm",
  status: "connected",
};

const DEFAULT_PREFERENCES: PrinterPreferences = {
  printers: {
    [AUTO_PRINTER_ID]: AUTO_PRINTER,
    [FIXED_PRINTER_ID]: FIXED_PRINTER,
  },
  clientPrinterId: FIXED_PRINTER_ID,
  autoPrint: true,
  openDrawerOn80mm: true,
  fullCutOn80mm: true,
};

function normalizePreferences(input?: Partial<PrinterPreferences>): PrinterPreferences {
  const printersInput = input?.printers && typeof input.printers === "object" ? input.printers : {};
  const printers = {
    [AUTO_PRINTER_ID]: AUTO_PRINTER,
    [FIXED_PRINTER_ID]: FIXED_PRINTER,
    ...printersInput,
  };
  const ids = Object.keys(printers);
  const requestedId = input?.clientPrinterId;
  const clientPrinterId = requestedId && printers[requestedId] ? requestedId : ids[0];

  return {
    printers,
    clientPrinterId,
    autoPrint:
      typeof input?.autoPrint === "boolean"
        ? input.autoPrint
        : DEFAULT_PREFERENCES.autoPrint,
    openDrawerOn80mm:
      typeof input?.openDrawerOn80mm === "boolean"
        ? input.openDrawerOn80mm
        : DEFAULT_PREFERENCES.openDrawerOn80mm,
    fullCutOn80mm:
      typeof input?.fullCutOn80mm === "boolean"
        ? input.fullCutOn80mm
        : DEFAULT_PREFERENCES.fullCutOn80mm,
  };
}

export function useBluetootPrinter() {
  const [preferences, setPreferences] = useState<PrinterPreferences>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PREFERENCES;

    try {
      const parsed = JSON.parse(stored) as Partial<PrinterPreferences>;
      return normalizePreferences(parsed);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return DEFAULT_PREFERENCES;
    }
  });

  const [isPrinting, setIsPrinting] = useState(false);
  const [printQueue, setPrintQueue] = useState<Array<() => Promise<void>>>([]);

  const savePreferences = useCallback((prefs: PrinterPreferences) => {
    const normalized = normalizePreferences(prefs);
    setPreferences(normalized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }, []);

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

    void processPrintQueue();

    return () => {
      isMounted = false;
    };
  }, [printQueue, isPrinting]);

  const getClientPrinter = useCallback((): PrinterDevice | null => {
    if (!preferences.clientPrinterId) return null;
    return preferences.printers[preferences.clientPrinterId] || AUTO_PRINTER;
  }, [preferences.clientPrinterId, preferences.printers]);

  useEffect(() => {
    const printerAddress = getClientPrinter()?.address;
    if (!printerAddress) return;

    const runKeepAlive = () => {
      void keepBluetoothPrinterAlive(printerAddress);
    };

    runKeepAlive();
    const intervalId = window.setInterval(runKeepAlive, 12000);
    window.addEventListener("focus", runKeepAlive);
    document.addEventListener("visibilitychange", runKeepAlive);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", runKeepAlive);
      document.removeEventListener("visibilitychange", runKeepAlive);
    };
  }, [getClientPrinter, preferences.clientPrinterId]);

  const selectClientPrinter = useCallback(async (): Promise<PrinterDevice> => {
    if (typeof navigator === "undefined" || !navigator.bluetooth?.requestDevice) {
      throw new Error("Este navegador no soporta selección manual de impresora Bluetooth.");
    }

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
    });

    const printer: PrinterDevice = {
      id: device.id,
      address: device.id,
      name: device.name || "Impresora Bluetooth",
      type: "80mm",
      status: "connected",
      lastUsed: new Date(),
    };

    savePreferences({
      ...preferences,
      printers: {
        ...preferences.printers,
        [printer.id]: printer,
      },
      clientPrinterId: printer.id,
      autoPrint: true,
    });

    return printer;
  }, [preferences, savePreferences]);

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
        const selectedPrinter = getClientPrinter() || AUTO_PRINTER;

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

        await printMultipleToDevice(selectedPrinter.address, [
          {
            escPosCommands,
            printerSize: "80mm",
            options: {
              openDrawer: preferences.openDrawerOn80mm,
              fullCut: preferences.fullCutOn80mm,
            },
          },
        ]);
        toast.success("Ticket de cliente enviado a impresora");
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getClientPrinter, preferences.fullCutOn80mm, preferences.openDrawerOn80mm]
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
        const selectedPrinter = getClientPrinter() || AUTO_PRINTER;

        const escPosCommands = generateCashCutTicketEscPos(
          sales,
          generatedAt,
          title,
          countSummary,
          details,
          {
            openDrawer: preferences.openDrawerOn80mm,
            fullCut: preferences.fullCutOn80mm,
          }
        );

        await printMultipleToDevice(selectedPrinter.address, [
          {
            escPosCommands,
            printerSize: "80mm",
            options: {
              openDrawer: preferences.openDrawerOn80mm,
              fullCut: preferences.fullCutOn80mm,
            },
          },
        ]);
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getClientPrinter, preferences.fullCutOn80mm, preferences.openDrawerOn80mm]
  );

  const printKitchenOrder = useCallback(
    async (items: CartItem[], orderNumber: number | null, customerName: string, dateStr: string) => {
      const printJob = async () => {
        const selectedPrinter = getClientPrinter() || AUTO_PRINTER;

        const escPosCommands = generateKitchenOrderEscPos(items, orderNumber, customerName, dateStr, {
          fullCut: false,
        });

        await printMultipleToDevice(selectedPrinter.address, [
          {
            escPosCommands,
            printerSize: "80mm",
          },
        ]);
        toast.success("Comanda de cocina enviada a impresora");
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
        const selectedPrinter = getClientPrinter() || AUTO_PRINTER;

        const kitchenEscPos = generateKitchenOrderEscPos(items, orderNumber, customerName, dateStr, {
          fullCut: false,
        });
        const clientEscPos = generateClientTicketEscPos(
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

        await printMultipleToDevice(selectedPrinter.address, [
          { escPosCommands: kitchenEscPos, printerSize: "80mm" },
          { escPosCommands: clientEscPos, printerSize: "80mm" },
        ]);
        toast.success("Comanda y ticket enviados a impresora 80mm");
      };

      await enqueuePrintJob(printJob);
    },
    [enqueuePrintJob, getClientPrinter, preferences.fullCutOn80mm, preferences.openDrawerOn80mm]
  );

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

  return {
    preferences,
    savePreferences,
    getClientPrinter,
    selectClientPrinter,
    printClientTicket,
    printCashCutTicket,
    printKitchenOrder,
    printKitchenAndClientCombined,
    printBoth,
    isPrinting,
    queueLength: printQueue.length,
  };
}
