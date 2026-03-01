// types/printer.ts
export interface PrinterDevice {
  address: string;
  name: string;
  id: string;
  type?: "80mm" | null;
  lastUsed?: Date;
  status?: "connected" | "disconnected";
}

export interface PrinterPreferences {
  printers: Record<string, PrinterDevice>;
  clientPrinterId?: string;
  autoPrint: boolean;
  openDrawerOn80mm: boolean;
  fullCutOn80mm: boolean;
}
