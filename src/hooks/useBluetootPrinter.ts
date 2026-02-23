import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  generateClientTicketHTML,
  generateKitchenOrderHTML,
  printToDevice,
  printViaBrowser,
} from "@/lib/printer-formats";
import type { CartItem } from "@/types/pos";

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
}

const STORAGE_KEY = "printerPreferences";

export function useBluetootPrinter() {
  const [preferences, setPreferences] = useState<PrinterPreferences>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (
      stored && {
        ...JSON.parse(stored),
        autoPrint: true,
        useBluetoothIfAvailable: true,
        fallbackToWeb: true,
      }
    ) || {
      autoPrint: true,
      useBluetoothIfAvailable: true,
      fallbackToWeb: true,
    };
  });

  const [isPrinting, setIsPrinting] = useState(false);
  const [printQueue, setPrintQueue] = useState<Array<() => Promise<void>>>([]);

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

  // Imprimir ticket del cliente
  const printClientTicket = useCallback(
    async (
      items: CartItem[],
      total: number,
      orderNumber: number | null,
      customerName: string,
      dateStr: string
    ) => {
      const printJob = async () => {
        try {
          const htmlContent = generateClientTicketHTML(
            items,
            total,
            orderNumber,
            customerName,
            dateStr
          );

          if (
            preferences.useBluetoothIfAvailable &&
            preferences.clientPrinter80mm
          ) {
            try {
              await printToDevice(
                preferences.clientPrinter80mm.address,
                htmlContent,
                "80mm"
              );
              toast.success("Ticket impreso en cliente");
              return;
            } catch (error) {
              console.error("Error Bluetooth:", error);
              if (!preferences.fallbackToWeb) throw error;
            }
          }

          // Fallback a impresión web
          printViaBrowser(htmlContent, "Ticket Cliente");
          toast.success("Ticket listo para imprimir");
        } catch (error) {
          console.error("Error al imprimir ticket:", error);
          toast.error("Error al imprimir ticket");
          throw error;
        }
      };

      setPrintQueue((prev) => [...prev, printJob]);
    },
    [preferences]
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

          if (
            preferences.useBluetoothIfAvailable &&
            preferences.kitchenPrinter58mm
          ) {
            try {
              await printToDevice(
                preferences.kitchenPrinter58mm.address,
                htmlContent,
                "58mm"
              );
              toast.success("Comanda enviada a cocina");
              return;
            } catch (error) {
              console.error("Error Bluetooth:", error);
              if (!preferences.fallbackToWeb) throw error;
            }
          }

          // Fallback a impresión web
          printViaBrowser(htmlContent, "Comanda Cocina");
          toast.success("Comanda lista para imprimir");
        } catch (error) {
          console.error("Error al imprimir comanda:", error);
          toast.error("Error al imprimir comanda");
          throw error;
        }
      };

      setPrintQueue((prev) => [...prev, printJob]);
    },
    [preferences]
  );

  // Imprimir ambos documentos (cliente y cocina)
  const printBoth = useCallback(
    async (
      items: CartItem[],
      total: number,
      orderNumber: number | null,
      customerName: string,
      dateStr: string
    ) => {
      // Primero cocina, luego cliente
      await printKitchenOrder(items, orderNumber, customerName, dateStr);
      await printClientTicket(items, total, orderNumber, customerName, dateStr);
    },
    [printKitchenOrder, printClientTicket]
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
    printKitchenOrder,
    printBoth,
    isPrinting,
    queueLength: printQueue.length,
  };
}
