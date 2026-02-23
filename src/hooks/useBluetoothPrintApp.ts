import { useCallback } from "react";
import { toast } from "sonner";
import type { CartItem } from "@/types/pos";

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
 * Usa el esquema URI my.bluetoothprint.scheme:// (más confiable)
 */
export function useBluetoothPrintApp() {
  /**
   * Crea un objeto de texto para enviar a la app
   */
  const createTextEntry = (
    content: string,
    bold: 0 | 1 = 0,
    align: 0 | 1 | 2 = 1, // default center
    format: 0 | 1 | 2 | 3 | 4 = 0
  ): PrinterData => ({
    type: 0, // text
    content,
    bold,
    align,
    format,
  });

  /**
   * Genera el JSON para imprimir ticket de cliente (80mm)
   */
  const generateClientTicketJSON = (
    items: CartItem[],
    total: number,
    orderNumber: number | null,
    customerName: string,
    businessName: string = "JULIANA",
    businessSubtitle: string = "BARRA COTIDIANA",
    businessAddress: string = "Av. Miguel Hidalgo #276",
    businessPhone: string = "Tel: 417 206 0111"
  ): PrinterData[] => {
    const data: PrinterData[] = [];

    // Space
    data.push(createTextEntry(" ", 0, 1, 0));

    // Header - Nombre negocio (grande, centrado, negrita)
    data.push(createTextEntry(businessName, 1, 1, 3)); // bold, center, double width
    data.push(createTextEntry(businessSubtitle, 0, 1, 0)); // center
    data.push(createTextEntry(businessAddress, 0, 1, 0)); // center
    data.push(createTextEntry(businessPhone, 0, 1, 0)); // center

    // Separador
    data.push(createTextEntry("=".repeat(42), 0, 0, 0));

    // Orden info
    data.push(createTextEntry(`Pedido: #${orderNumber || "---"}`, 1, 0, 0)); // bold, left
    data.push(createTextEntry(`Nombre: ${customerName || "---"}`, 1, 0, 0)); // bold, left
    const dateStr = new Date().toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
    data.push(createTextEntry(dateStr, 0, 0, 0)); // left

    // Separador
    data.push(createTextEntry("=".repeat(42), 0, 0, 0));

    // Items
    items.forEach((item) => {
      const itemLine = `${item.quantity}x ${item.product.name}${
        item.productSize ? ` (${item.productSize.name})` : ""
      }`;
      const priceLine = `$${item.subtotal.toFixed(0)}`;

      // Nombre del item
      data.push({
        type: 4, // HTML
        content: `<div style="display: flex; justify-content: space-between;"><span>${itemLine}</span><span style="text-align: right;">${priceLine}</span></div>`,
      });

      if (item.customLabel) {
        data.push(createTextEntry(`  • ${item.customLabel}`, 0, 0, 4)); // small, left
      }
    });

    // Separador
    data.push(createTextEntry("=".repeat(42), 0, 0, 0));

    // Total
    data.push(createTextEntry(`TOTAL: $${total.toFixed(0)}`, 1, 1, 3)); // bold, center, double width

    // Separador
    data.push(createTextEntry("=".repeat(42), 0, 0, 0));

    // Footer
    data.push(createTextEntry("¡Gracias por tu visita!", 0, 1, 0)); // center
    data.push(createTextEntry("Vuelve pronto", 0, 1, 0)); // center
    data.push(createTextEntry(" ", 0, 1, 0)); // space

    return data;
  };

  /**
   * Genera el JSON para imprimir comanda de cocina (58mm)
   */
  const generateKitchenOrderJSON = (
    items: CartItem[],
    orderNumber: number | null,
    customerName: string
  ): PrinterData[] => {
    const data: PrinterData[] = [];

    // Space
    data.push(createTextEntry(" ", 0, 1, 0));

    // Header
    data.push(createTextEntry("COMANDA", 1, 1, 3)); // bold, center, double width
    data.push(createTextEntry(`#${orderNumber || "---"}`, 1, 1, 1)); // bold, center, double height

    // Separador
    data.push(createTextEntry("=".repeat(32), 0, 0, 0));

    // Cliente y hora
    data.push(createTextEntry(`👤 ${customerName || "Sin nombre"}`, 1, 0, 0)); // bold, left
    const dateStr = new Date().toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
    data.push(createTextEntry(`🕐 ${dateStr}`, 0, 0, 0)); // left

    // Separador
    data.push(createTextEntry("=".repeat(32), 0, 0, 0));

    // Items
    items.forEach((item) => {
      const itemLine = `${item.quantity}x ${item.product.name.toUpperCase()}`;
      data.push(createTextEntry(itemLine, 1, 0, 0)); // bold, left

      if (item.productSize) {
        data.push(createTextEntry(`  Tamaño: ${item.productSize.name}`, 0, 0, 0)); // left
      }

      if (item.customLabel) {
        data.push(createTextEntry(`  • ${item.customLabel}`, 0, 0, 0)); // left
      }
    });

    // Separador
    data.push(createTextEntry("=".repeat(32), 0, 0, 0));

    // Acción
    data.push(createTextEntry("PREPARAR AHORA", 1, 1, 3)); // bold, center, double width

    data.push(createTextEntry(" ", 0, 1, 0)); // space

    return data;
  };

  /**
   * Envía el JSON a la app Bluetooth Print via esquema URI
   * Usa my.bluetoothprint.scheme:// que es más confiable
   */
  const sendToPrintApp = useCallback((printDataJSON: PrinterData[]) => {
    try {
      // Verificar si estamos en un navegador con soporte para esquemas personalizados
      if (!window.location) {
        toast.error("Navegador no soportado");
        return false;
      }

      // Convertir el JSON a string
      const jsonString = JSON.stringify(printDataJSON);

      // Codificar para URL (sin base64 para que sea más compatible)
      const encodedData = encodeURIComponent(jsonString);

      // Esquema URI para Bluetooth Print App
      // NOTA: La app debe tener "Browser Print" habilitado en sus configuraciones
      const schemeUrl = `my.bluetoothprint.scheme://data:application/json,${jsonString}`;

      // Como data URLs pueden no funcionar con esquemas personalizados,
      // alternativa: usar un endpoint API si está disponible
      // Por ahora, intentamos con dirección local o mostramos instrucciones
      
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        // Para localhost, necesitaría un servidor
        toast.error(
          "Para usar Bluetooth Print necesitas: " +
          "1. Tener la app instalada " +
          "2. Habilitar 'Browser Print' en la app " +
          "3. Un endpoint JSON que retorne los datos"
        );
        return false;
      }

      // Intentar abrir el esquema
      window.location.href = schemeUrl;

      // Si llegamos aquí, probablemente no está instalada la app
      setTimeout(() => {
        toast.error(
          "Bluetooth Print App no detectada. " +
          "Instálala desde Play Store: https://play.google.com/store/apps/details?id=mate.bluetoothprint"
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
    (
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
      const printData = generateClientTicketJSON(
        items,
        total,
        orderNumber,
        customerName,
        businessSettings?.name,
        businessSettings?.subtitle,
        businessSettings?.address,
        businessSettings?.phone
      );

      return sendToPrintApp(printData);
    },
    [generateClientTicketJSON, sendToPrintApp]
  );

  /**
   * Imprime la comanda de cocina
   */
  const printKitchenOrder = useCallback(
    (
      items: CartItem[],
      orderNumber: number | null,
      customerName: string
    ) => {
      const printData = generateKitchenOrderJSON(items, orderNumber, customerName);
      return sendToPrintApp(printData);
    },
    [generateKitchenOrderJSON, sendToPrintApp]
  );

  /**
   * Verifica si Bluetooth Print App está disponible
   */
  const isBluetoothPrintAppAvailable = useCallback((): boolean => {
    // En navegador, simplemente asumimos que puede estarlo
    // La verificación real ocurre cuando se intenta usar
    return true;
  }, []);

  return {
    printClientTicket,
    printKitchenOrder,
    isBluetoothPrintAppAvailable,
    generateClientTicketJSON,
    generateKitchenOrderJSON,
  };
}
