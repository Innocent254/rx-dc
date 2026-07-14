export type Device = {
  serial: string;
  state: string;
  product?: string;
  model?: string;
  device?: string;
  transportId?: string;
  connection: 'usb' | 'wireless';
  manufacturer?: string;
};

export type DeviceInfo = Device & {
  androidVersion?: string;
  sdk?: string;
  miuiVersion?: string;
  hyperOsVersion?: string;
  batteryLevel: number;
  charging: boolean;
  storageTotal?: string;
  storageUsed?: string;
  storageFree?: string;
  resolution?: string;
};

export type BackendStatus = {
  service: string;
  uptimeSeconds: number;
  adbAvailable: boolean;
  scrcpyAvailable: boolean;
  deviceCount: number;
  message: string;
};

export type Dependency = {
  name: 'adb' | 'scrcpy' | string;
  available: boolean;
  path?: string;
  version?: string;
};

export type Activity = {
  id: string;
  timestamp: string;
  level: 'success' | 'info' | 'warning' | 'error' | string;
  message: string;
};

export type AppPackage = {
  package: string;
  label: string;
};

export type MDNSService = {
  name: string;
  address: string;
  type: string;
};

export type Page = 'dashboard' | 'devices' | 'desktop' | 'files' | 'apps' | 'clipboard' | 'settings' | 'about';

export type AppInfo = {
  version: string;
  platform: string;
  arch: string;
  darkMode: boolean;
  logsPath: string;
};
