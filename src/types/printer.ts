// types/printer.ts
export interface PrinterDevice {
  address: string;
  name: string;
  id: string;
  type?: '80mm' | '58mm' | null;  // null significa sin asignar
  lastUsed?: Date;
  status?: 'connected' | 'disconnected' | 'pairing';
}

export interface PrinterPreferences {
  printers: {
    [key: string]: PrinterDevice;  // Almacenar múltiples impresoras
  };
  clientPrinterId?: string;  // ID de la impresora asignada a cliente (80mm)
  kitchenPrinterId?: string;  // ID de la impresora asignada a cocina (58mm)
  autoPrint: boolean;
  useBluetoothIfAvailable: boolean;
  fallbackToWeb: boolean;
  openDrawerOn80mm: boolean;
  fullCutOn80mm: boolean;
}