import { useCallback } from "react";
import { toast } from "sonner";
import type { CartItem } from "@/types/pos";

/**
 * Hook para integrar con la app Bluetooth Print (mate.bluetoothprint)
 * Genera strings en el formato requerido por la app y los envía vía Intent
 */
export function useBluetoothPrintApp() {
  /**
   * Formato: <BAF>Content
   * B: bold (0=no, 1=yes)
   * A: align (0=left, 1=center, 2=right)
   * F: format (0=normal, 1=double height, 2=double height+width, 3=double width)
   */
  const formatText = (
    content: string,
    bold: 0 | 1 = 0,
    align: 0 | 1 | 2 = 0,
    format: 0 | 1 | 2 | 3 = 0
  ): string => {
    return `<${bold}${align}${format}>${content}`;
  };

  /**
   * Genera el string para imprimir ticket de cliente (80mm)
   */
  const generateClientTicketString = (
    items: CartItem[],
    total: number,
    orderNumber: number | null,
    customerName: string,
    dateStr: string,
    businessName: string = "JULIANA",
    businessSubtitle: string = "BARRA COTIDIANA",
    businessAddress: string = "Av. Miguel Hidalgo #276",
    businessPhone: string = "Tel: 417 206 0111"
  ): string => {
    let str = "";

    // Header - Nombre negocio (grande, centrado, negrita)
    str += formatText("", 0, 1, 0) + "\n"; // Línea en blanco
    str += formatText(businessName, 1, 1, 2) + "\n"; // Double height + width, bold, center
    str += formatText(businessSubtitle, 0, 1, 0) + "\n";
    str += formatText(businessAddress, 0, 1, 0) + "\n";
    str += formatText(businessPhone, 0, 1, 0) + "\n";

    // Separador
    str += formatText("=".repeat(42), 0, 0, 0) + "\n";

    // Orden info
    str += formatText(`Pedido: #${orderNumber || "---"}`, 1, 0, 0) + "\n";
    str += formatText(`Nombre: ${customerName || "---"}`, 1, 0, 0) + "\n";
    str += formatText(dateStr, 0, 0, 0) + "\n";

    // Separador
    str += formatText("=".repeat(42), 0, 0, 0) + "\n";

    // Items
    items.forEach((item) => {
      const itemLine = `${item.quantity}x ${item.product.name}${
        item.productSize ? ` (${item.productSize.name})` : ""
      }`;
      const priceLine = `$${item.subtotal.toFixed(0)}`;

      // Nombre y precio alineados
      str += formatText(itemLine, 0, 0, 0) + "\n";
      str += formatText(priceLine, 0, 2, 0) + "\n"; // Alineado a derecha

      if (item.customLabel) {
        str += formatText(`  • ${item.customLabel}`, 0, 0, 0) + "\n";
      }
    });

    // Separador
    str += formatText("=".repeat(42), 0, 0, 0) + "\n";

    // Total
    str += formatText(`TOTAL: $${total.toFixed(0)}`, 1, 1, 2) + "\n"; // Bold, center, double

    // Separador
    str += formatText("=".repeat(42), 0, 0, 0) + "\n";

    // Footer
    str += formatText("¡Gracias por tu visita!", 0, 1, 0) + "\n";
    str += formatText("Vuelve pronto", 0, 1, 0) + "\n";
    str += formatText("", 0, 1, 0) + "\n"; // Línea en blanco

    return str;
  };

  /**
   * Genera el string para imprimir comanda de cocina (58mm)
   */
  const generateKitchenOrderString = (
    items: CartItem[],
    orderNumber: number | null,
    customerName: string,
    dateStr: string
  ): string => {
    let str = "";

    // Header
    str += formatText("", 0, 1, 0) + "\n"; // Línea en blanco
    str += formatText("COMANDA", 1, 1, 2) + "\n"; // Bold, center, double
    str += formatText(`#${orderNumber || "---"}`, 1, 1, 1) + "\n"; // Bold, center, double height

    // Separador
    str += formatText("=".repeat(32), 0, 0, 0) + "\n";

    // Cliente y hora
    str += formatText(`👤 ${customerName || "Sin nombre"}`, 1, 0, 0) + "\n";
    str += formatText(`🕐 ${dateStr}`, 0, 0, 0) + "\n";

    // Separador
    str += formatText("=".repeat(32), 0, 0, 0) + "\n";

    // Items
    items.forEach((item) => {
      const itemLine = `${item.quantity}x ${item.product.name.toUpperCase()}`;
      str += formatText(itemLine, 1, 0, 0) + "\n"; // Bold

      if (item.productSize) {
        str += formatText(`  Tamaño: ${item.productSize.name}`, 0, 0, 0) + "\n";
      }

      if (item.customLabel) {
        str += formatText(`  • ${item.customLabel}`, 0, 0, 0) + "\n";
      }
    });

    // Separador
    str += formatText("=".repeat(32), 0, 0, 0) + "\n";

    // Acción
    str += formatText("PREPARAR AHORA", 1, 1, 2) + "\n"; // Bold, center, double

    str += formatText("", 0, 1, 0) + "\n"; // Línea en blanco

    return str;
  };

  /**
   * Envía el string a la app Bluetooth Print via Intent
   * Solo funciona en WebView de Android
   */
  const sendToPrintApp = useCallback((printData: string) => {
    try {
      // Verificar si estamos en Android WebView
      if (!window.android) {
        toast.error("Bluetooth Print App no disponible. Instala la app desde Play Store");
        return false;
      }

      // Enviar a la app vía método Java/Android
      if (typeof (window as any).BluetoothPrint !== "undefined") {
        (window as any).BluetoothPrint.print(printData);
        return true;
      }

      // Alternativa: Intent directo (si la app está instalada)
      // Esta es una aproximación que funciona en algunos WebViews
      const intentData = encodeURIComponent(printData);
      window.location.href = `intent://print?text=${intentData}#Intent;package=mate.bluetoothprint;end`;

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
      const dateStr = new Date().toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      });

      const printData = generateClientTicketString(
        items,
        total,
        orderNumber,
        customerName,
        dateStr,
        businessSettings?.name,
        businessSettings?.subtitle,
        businessSettings?.address,
        businessSettings?.phone
      );

      return sendToPrintApp(printData);
    },
    [generateClientTicketString, sendToPrintApp]
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
      const dateStr = new Date().toLocaleString("es-MX", {
        dateStyle: "short",
        timeStyle: "short",
      });

      const printData = generateKitchenOrderString(
        items,
        orderNumber,
        customerName,
        dateStr
      );

      return sendToPrintApp(printData);
    },
    [generateKitchenOrderString, sendToPrintApp]
  );

  /**
   * Verifica si Bluetooth Print App está disponible
   */
  const isBluetoothPrintAppAvailable = useCallback((): boolean => {
    return !!(window as any).BluetoothPrint || !!(window as any).android;
  }, []);

  return {
    printClientTicket,
    printKitchenOrder,
    isBluetoothPrintAppAvailable,
    generateClientTicketString,
    generateKitchenOrderString,
  };
}
