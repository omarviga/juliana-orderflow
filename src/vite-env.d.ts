/// <reference types="vite/client" />

// Web Bluetooth API types
interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  watchingAdvertisements: boolean;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void;
}

interface BluetoothRemoteGATTServer {
  device: BluetoothDevice;
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(name: string): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(name?: string): Promise<BluetoothRemoteGATTService[]>;
}

interface BluetoothRemoteGATTService extends BluetoothRemoteGATTCharacteristic {
  uuid: string;
  device: BluetoothDevice;
  getCharacteristic(
    name: string
  ): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(name?: string): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  service: BluetoothRemoteGATTService | undefined;
  uuid: string;
  properties: BluetoothCharacteristicProperties;
  value: DataView | undefined;
  writeValue(value: BufferSource): Promise<void>;
  readValue(): Promise<DataView>;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
}

interface BluetoothCharacteristicProperties {
  broadcast: boolean;
  read: boolean;
  writeWithoutResponse: boolean;
  write: boolean;
  notify: boolean;
  indicate: boolean;
  authenticatedSignedWrites: boolean;
  reliableWrite: boolean;
  writableAuxiliaries: boolean;
}

interface BluetoothRequestDeviceOptions {
  filters?: BluetoothLEScanFilterInit[];
  optionalServices?: (string | number)[];
  acceptAllDevices?: boolean;
}

interface BluetoothLEScanFilterInit {
  services?: (string | number)[];
  name?: string;
  namePrefix?: string;
  manufacturerId?: number;
  manufacturerData?: BufferSource;
  serviceDataUUID?: string;
}

interface Navigator {
  bluetooth?: {
    requestDevice(options: BluetoothRequestDeviceOptions): Promise<BluetoothDevice>;
    getAvailability(): Promise<boolean>;
    getDevices(): Promise<BluetoothDevice[]>;
  };
}

