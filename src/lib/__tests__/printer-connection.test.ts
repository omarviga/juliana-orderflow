import { beforeEach, describe, expect, it, vi } from "vitest";
import { printMultipleToDevice } from "@/lib/printer-formats";

type MockCharacteristic = {
  properties: { writeWithoutResponse: boolean; write: boolean };
  writeValueWithoutResponse: ReturnType<typeof vi.fn>;
  writeValue: ReturnType<typeof vi.fn>;
  uuid: string;
};

function createBluetoothMocks() {
  const characteristic: MockCharacteristic = {
    properties: { writeWithoutResponse: true, write: false },
    writeValueWithoutResponse: vi.fn(async () => {}),
    writeValue: vi.fn(async () => {}),
    uuid: "0000ffe1-0000-1000-8000-00805f9b34fb",
  };

  const service = {
    uuid: "0000ffe0-0000-1000-8000-00805f9b34fb",
    getCharacteristics: vi.fn(async () => [characteristic]),
  };

  const server = {
    getPrimaryServices: vi.fn(async () => [service]),
  };

  const gatt = {
    connected: false,
    connect: vi.fn(async () => server),
    disconnect: vi.fn(() => {}),
  };

  const device = {
    id: "printer-1",
    name: "GL Printer",
    gatt,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  const bluetooth = {
    getDevices: vi.fn(async () => [device]),
    requestDevice: vi.fn(async () => device),
  };

  Object.defineProperty(navigator, "bluetooth", {
    configurable: true,
    value: bluetooth,
  });

  return { bluetooth, characteristic, gatt };
}

describe("printMultipleToDevice connection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("prints multiple times using saved paired device without prompting again", async () => {
    const { bluetooth, characteristic } = createBluetoothMocks();
    const job = { escPosCommands: [0x1b, 0x40], printerSize: "80mm" as const };

    await printMultipleToDevice("printer-1", [job]);
    await printMultipleToDevice("printer-1", [job]);

    expect(bluetooth.requestDevice).not.toHaveBeenCalled();
    expect(characteristic.writeValueWithoutResponse).toHaveBeenCalled();
    expect(characteristic.writeValueWithoutResponse.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("retries after a write failure and succeeds on second attempt", async () => {
    const { characteristic, gatt } = createBluetoothMocks();
    const job = { escPosCommands: [0x1b, 0x40], printerSize: "80mm" as const };
    let first = true;
    characteristic.writeValueWithoutResponse = vi.fn(async () => {
      if (first) {
        first = false;
        throw new Error("write failed");
      }
    });

    await expect(printMultipleToDevice("printer-1", [job])).resolves.toBeUndefined();
    expect(gatt.connect).toHaveBeenCalledTimes(2);
    expect(characteristic.writeValueWithoutResponse.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
