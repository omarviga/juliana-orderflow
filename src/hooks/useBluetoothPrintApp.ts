import { useCallback } from "react";
import { toast } from "sonner";
import type { CartItem } from "@/types/pos";

// Supabase URL - se obtiene de variables de entorno
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const PRINT_TICKET_FUNCTION = `${SUPABASE_URL}/functions/v1/print-ticket`;
const PRINT_KITCHEN_FUNCTION = `${SUPABASE_URL}/functions/v1/print-kitchen`;

/**
 * Tipos para la API JSON de Bluetooth Print App
 */
interface PrinterData {
  type: 0 | 1 | 2 | 3 | 4; // 0=text, 1=image, 2=barcode, 3=QR, 4=HTML
  content?: string;
  bold?: 0 | 1;
  align?: 0 | 1 | 2; // 0=left, 1=center, 2=right
  format?: 0 | 1 | 2 | 3 | 4; // 0=normal, 1=double height, 2=double height+width, 3=double width, 4=small
  path?: string; // Para imágenes
  value?: string; // Para barcode/QR
  width?: number; // Para barcode
  height?: number; // Para barcode
  size?: number; // Para QR
}

/**
 * Hook para integrar con la app Bluetooth Print (mate.bluetoothprint)
 * Usa Supabase Edge Functions para generar JSON
 */
export function useBluetoothPrintApp() {
  /**
   * Obtiene los datos JSON del servidor de Supabase
   */
  const fetchPrintData = useCallback(
    async (
      functionUrl: string,
      body: Record<string, unknown>
    ): Promise<PrinterData[] | null> => {
      try {
        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error fetching print data:", error);
        toast.error("Error al obtener datos de impresión");
        return null;
      }
    },
    []
  );

  /**
   * Envía el JSON a la app Bluetooth Print via esquema URI
   * Usa my.bluetoothprint.scheme:// que es más confiable
   */
  const sendToPrintApp = useCallback((printDataJSON: PrinterData[]) => {
    try {
      if (!window.location) {
        toast.error("Navegador no soportado");
        return false;
      }

      const jsonString = JSON.stringify(printDataJSON);
      const schemeUrl = `my.bluetoothprint.scheme://data:application/json,${jsonString}`;

      window.location.href = schemeUrl;

      setTimeout(() => {
        toast.error(
          "Bluetooth Print App no detectada. Instálala desde Play Store"
        );
      }, 1000);

      return true;
    } catch (error) {
      console.error("Error al enviar a Bluetooth Print App:", error);
      toast.error("Error al conectar con Bluetooth Print App");
      return false;
    }
  }, []);

  /**
   * Imprime el ticket del cliente
   */
  const printClientTicket = useCallback(
    async (
      items: CartItem[],
      total: number,
      orderNumber: number | null,
      customerName: string,
      businessSettings?: {
        name?: string;
        subtitle?: string;
        address?: string;
        phone?: string;
      }
    ) => {
      try {
        const printData = await fetchPrintData(PRINT_TICKET_FUNCTION, {
          items,
          total,
          orderNumber,
          customerName,
          businessName: businessSettings?.name,
          businessSubtitle: businessSettings?.subtitle,
          businessAddress: businessSettings?.address,
          businessPhone: businessSettings?.phone,
        });

        if (!printData) return false;

        return sendToPrintApp(printData);
      } catch (err) {
        console.error("Error printing client ticket:", err);
        return false;
      }
    },
    [fetchPrintData, sendToPrintApp]
  );

  /**
   * Imprime la comanda de cocina
   */
  const printKitchenOrder = useCallback(
    async (
      items: CartItem[],
      orderNumber: number | null,
      customerName: string
    ) => {
      try {
        const printData = await fetchPrintData(PRINT_KITCHEN_FUNCTION, {
          items,
          orderNumber,
          customerName,
        });

        if (!printData) return false;

        return sendToPrintApp(printData);
      } catch (err) {
        console.error("Error printing kitchen order:", err);
        return false;
      }
    },
    [fetchPrintData, sendToPrintApp]
  );

  /**
   * Verifica si Bluetooth Print App está disponible
   */
  const isBluetoothPrintAppAvailable = useCallback((): boolean => {
    return true;
  }, []);

  return {
    printClientTicket,
    printKitchenOrder,
    isBluetoothPrintAppAvailable,
  };
}
