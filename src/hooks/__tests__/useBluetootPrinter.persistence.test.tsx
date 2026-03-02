import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useBluetootPrinter } from "@/hooks/useBluetootPrinter";

vi.mock("@/lib/printer-formats", () => ({
  generateCashCutTicketEscPos: vi.fn(() => []),
  generateClientTicketEscPos: vi.fn(() => []),
  generateKitchenOrderEscPos: vi.fn(() => []),
  keepBluetoothPrinterAlive: vi.fn(async () => {}),
  printMultipleToDevice: vi.fn(async () => {}),
}));

describe("useBluetootPrinter persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("persists selected printer and reloads it from localStorage", async () => {
    const requestDevice = vi.fn(async () => ({
      id: "printer-1",
      name: "GL Printer",
    }));

    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: { requestDevice },
    });

    const { result, unmount } = renderHook(() => useBluetootPrinter());

    await act(async () => {
      await result.current.selectClientPrinter();
    });

    const raw = localStorage.getItem("printerPreferences");
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw || "{}");
    expect(saved.clientPrinterId).toBe("printer-1");
    expect(saved.printers["printer-1"]?.name).toBe("GL Printer");

    unmount();

    const { result: reloaded } = renderHook(() => useBluetootPrinter());
    expect(reloaded.current.getClientPrinter()?.id).toBe("printer-1");
    expect(reloaded.current.getClientPrinter()?.name).toBe("GL Printer");
  });
});
