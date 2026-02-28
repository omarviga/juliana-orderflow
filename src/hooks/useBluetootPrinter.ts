// useBluetootPrinter.ts - VERSIÓN SOLO ESC/POS

import { useState, useCallback } from "react";
import { toast } from "sonner";
import type { CartItem } from "@/types/pos";
import type { CashRegisterSale } from "@/lib/cash-register";
import {
  printClientTicketEscPos,
  printKitchenOrderEscPos,
  printBothEscPos,
  isEscPosAppAvailable,
} from "@/lib/printer-formats";

// ============================================
// TIPOS
// ============================================

export interface PrinterDevice {
  id: string;
  address: string;
  name: string;
  type: "80mm" | "58mm" | null;
  status: "connected" | "disconnected" | "pairing";
  lastUsed?: Date;
}

export interface PrinterPreferences {
  printers: Record<string, PrinterDevice>;
  clientPrinterId?: string;
  kitchenPrinterId?: string;
  autoPrint: boolean;
  useBluetoothIfAvailable: boolean;
  fallbackToWeb: boolean;
  openDrawerOn80mm: boolean;
  fullCutOn80mm: boolean;
}

// ============================================
// CONFIGURACIÓN
// ============================================

const STORAGE_KEY = "printerPreferences";
const MAC_ADDRESS_KEY = "printerMacAddress";

const DEFAULT_MAC = "00:11:22:33:44:55"; // Cambia esto por tu MAC real

const DEFAULT_PREFERENCES: PrinterPreferences = {
  printers: {},
  clientPrinterId: undefined,
  kitchenPrinterId: undefined,
  autoPrint: true,
  useBluetoothIfAvailable: true,
  fallbackToWeb: false,
  openDrawerOn80mm: true,
  fullCutOn80mm: true,
};

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useBluetootPrinter() {
  const [macAddress, setMacAddress] = useState<string>(() => {
    return localStorage.getItem(MAC_ADDRESS_KEY) || DEFAULT_MAC;
  });

  const [preferences, setPreferences] = useState<PrinterPreferences>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return DEFAULT_PREFERENCES;
      }
    }
    return DEFAULT_PREFERENCES;
  });

  const [isPrinting, setIsPrinting] = useState(false);
  const [printQueue, setPrintQueue] = useState<Array<() => Promise<void>>>([]);

  // ============================================
  // FUNCIONES DE CONFIGURACIÓN
  // ============================================

  const saveMacAddress = useCallback((newMac: string) => {
    setMacAddress(newMac);
    localStorage.setItem(MAC_ADDRESS_KEY, newMac);
    toast.success("MAC address guardada");
  }, []);

  const savePreferences = useCallback((prefs: PrinterPreferences) => {
    setPreferences(prefs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, []);

  const updatePrinterType = useCallback((
    printerId: string,
    type: "80mm" | "58mm" | null
  ) => {
    setPreferences((prev) => {
      const newPrinters = { ...prev.printers };

      if (!newPrinters[printerId]) {
        newPrinters[printerId] = {
          id: printerId,
          address: printerId,
          name: `Impresora ${printerId.slice(0, 8)}`,
          type: null,
          status: "disconnected",
        };
      }

      // Si estamos asignando un tipo, quitar ese tipo de otras impresoras
      if (type) {
        Object.keys(newPrinters).forEach((key) => {
          if (newPrinters[key]?.type === type) {
            newPrinters[key] = { ...newPrinters[key], type: null };
          }
        });
      }

      newPrinters[printerId] = {
        ...newPrinters[printerId],
        type,
      };

      const newPrefs = {
        ...prev,
        printers: newPrinters,
        clientPrinterId: type === "80mm" ? printerId : prev.clientPrinterId,
        kitchenPrinterId: type === "58mm" ? printerId : prev.kitchenPrinterId,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
      return newPrefs;
    });
  }, []);

  // ============================================
  // FUNCIONES DE IMPRESIÓN
  // ============================================

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
          }
        },
      ]);
    });
  }, []);

  // Procesar cola de impresión
  useState(() => {
    const processQueue = async () => {
      if (printQueue.length === 0 || isPrinting) return;

      setIsPrinting(true);
      const job = printQueue[0];

      try {
        await job();
      } catch (error) {
        console.error("Error en trabajo de impresión:", error);
        toast.error("Error al imprimir");
      } finally {
        setPrintQueue((prev) => prev.slice(1));
        setIsPrinting(false);
      }
    };

    processQueue();
  });

  // ============================================
  // IMPRESIÓN DE TICKETS
  // ============================================

  const printClientTicket = useCallback(async (
    items: CartItem[],
    total: number,
    orderNumber: number | null,
    customerName: string,
    dateStr: string,
    paymentMethodLabel: string = "Efectivo"
  ) => {
    const job = async () => {
      try {
        if (!isEscPosAppAvailable()) {
          throw new Error("ESC/POS PrintService no disponible");
        }

        const success = await printClientTicketEscPos(
          macAddress,
          items,
          total,
          orderNumber,
          customerName,
          dateStr,
          paymentMethodLabel,
          {
            openDrawer: preferences.openDrawerOn80mm,
            fullCut: preferences.fullCutOn80mm,
            drawerNumber: 2 // Usando cajón 2 como configuraste
          }
        );

        if (success) {
          toast.success("Ticket enviado a impresora");
        } else {
          throw new Error("Error al imprimir");
        }
      } catch (error) {
        console.error("Error imprimiendo ticket:", error);
        toast.error("Error al imprimir ticket");
        throw error;
      }
    };

    await enqueuePrintJob(job);
  }, [macAddress, preferences, enqueuePrintJob]);

  const printKitchenOrder = useCallback(async (
    items: CartItem[],
    orderNumber: number | null,
    customerName: string,
    dateStr: string
  ) => {
    const job = async () => {
      try {
        if (!isEscPosAppAvailable()) {
          throw new Error("ESC/POS PrintService no disponible");
        }

        const success = await printKitchenOrderEscPos(
          macAddress,
          items,
          orderNumber,
          customerName,
          dateStr,
          { fullCut: preferences.fullCutOn80mm }
        );

        if (success) {
          toast.success("Comanda enviada a cocina");
        } else {
          throw new Error("Error al imprimir");
        }
      } catch (error) {
        console.error("Error imprimiendo comanda:", error);
        toast.error("Error al imprimir comanda");
        throw error;
      }
    };

    await enqueuePrintJob(job);
  }, [macAddress, preferences, enqueuePrintJob]);

  const printBoth = useCallback(async (
    items: CartItem[],
    total: number,
    orderNumber: number | null,
    customerName: string,
    dateStr: string,
    paymentMethodLabel: string = "Efectivo"
  ) => {
    const job = async () => {
      try {
        if (!isEscPosAppAvailable()) {
          throw new Error("ESC/POS PrintService no disponible");
        }

        const success = await printBothEscPos(
          macAddress,
          items,
          total,
          orderNumber,
          customerName,
          dateStr,
          paymentMethodLabel,
          {
            openDrawer: preferences.openDrawerOn80mm,
            fullCut: preferences.fullCutOn80mm,
            drawerNumber: 2
          }
        );

        if (success) {
          toast.success("Comanda y ticket enviados");
        } else {
          throw new Error("Error al imprimir");
        }
      } catch (error) {
        console.error("Error imprimiendo ambos:", error);
        toast.error("Error al imprimir");
        throw error;
      }
    };

    await enqueuePrintJob(job);
  }, [macAddress, preferences, enqueuePrintJob]);

  // ============================================
  // FUNCIONES PARA COMPATIBILIDAD (no hacen nada)
  // ============================================

  // Estas funciones existen solo para no romper el código existente
  const scanForPrinters = useCallback(async () => {
    toast.info("En Android usa la MAC address directamente");
    return undefined;
  }, []);

  const pairClientPrinter = useCallback(async () => {
    toast.info("Ingresa la MAC address de la impresora 80mm");
    return false;
  }, []);

  const pairKitchenPrinter = useCallback(async () => {
    toast.info("Ingresa la MAC address de la impresora 58mm");
    return false;
  }, []);

  const unpairClientPrinter = useCallback(() => {
    // No hace nada
  }, []);

  const unpairKitchenPrinter = useCallback(() => {
    // No hace nada
  }, []);

  const assignPrinterType = useCallback(() => {
    // No hace nada
  }, []);

  const removePrinter = useCallback(() => {
    // No hace nada
  }, []);

  const resetPrinterStorage = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MAC_ADDRESS_KEY);
    setPreferences(DEFAULT_PREFERENCES);
    setMacAddress(DEFAULT_MAC);
    toast.success("Configuración reiniciada");
  }, []);

  // ============================================
  // RETURN
  // ============================================

  return {
    // Estado
    preferences,
    macAddress,
    isPrinting,
    queueLength: printQueue.length,
    availablePrinters: [], // Vacío porque no usamos escaneo
    isScanning: false,

    // Funciones de configuración
    saveMacAddress,
    savePreferences,
    assignPrinterType,
    removePrinter,
    resetPrinterStorage,

    // Funciones de impresión (las importantes)
    printClientTicket,
    printKitchenOrder,
    printBoth,

    // Funciones de compatibilidad (no hacen nada)
    scanForPrinters,
    pairClientPrinter,
    pairKitchenPrinter,
    unpairClientPrinter,
    unpairKitchenPrinter,

    // Getters
    getClientPrinter: useCallback(() => {
      return preferences.clientPrinterId ? {
        id: preferences.clientPrinterId,
        address: preferences.clientPrinterId,
        name: "Impresora 80mm",
        type: "80mm" as const,
        status: "connected" as const,
      } : undefined;
    }, [preferences.clientPrinterId]),

    getKitchenPrinter: useCallback(() => {
      return preferences.kitchenPrinterId ? {
        id: preferences.kitchenPrinterId,
        address: preferences.kitchenPrinterId,
        name: "Impresora 58mm",
        type: "58mm" as const,
        status: "connected" as const,
      } : undefined;
    }, [preferences.kitchenPrinterId]),
  };
}