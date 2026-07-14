import type { Activity, AppPackage, BackendStatus, Dependency, Device, DeviceInfo, MDNSService } from './types';

export const api = {
  status: () => window.rxdc.request<BackendStatus>('/api/status'),
  dependencies: () => window.rxdc.request<Dependency[]>('/api/dependencies'),
  devices: () => window.rxdc.request<Device[]>('/api/devices'),
  deviceInfo: (serial: string) => window.rxdc.request<DeviceInfo>(`/api/devices/${encodeURIComponent(serial)}`),
  screenshot: (serial: string) => window.rxdc.request<string>(`/api/devices/${encodeURIComponent(serial)}/screenshot`, { responseType: 'dataUrl' }),
  apps: (serial: string) => window.rxdc.request<AppPackage[]>(`/api/devices/${encodeURIComponent(serial)}/apps`),
  launchApp: (serial: string, packageName: string) => window.rxdc.request('/api/apps/launch', { method: 'POST', body: { serial, package: packageName } }),
  startSession: (serial: string) => window.rxdc.request('/api/session/start', { method: 'POST', body: { serial } }),
  tap: (serial: string, x: number, y: number) => window.rxdc.request('/api/input/tap', { method: 'POST', body: { serial, x, y } }),
  swipe: (serial: string, x1: number, y1: number, x2: number, y2: number, duration = 300) => window.rxdc.request('/api/input/swipe', { method: 'POST', body: { serial, x1, y1, x2, y2, duration } }),
  key: (serial: string, keyCode: string) => window.rxdc.request('/api/input/key', { method: 'POST', body: { serial, keyCode } }),
  text: (serial: string, text: string) => window.rxdc.request('/api/input/text', { method: 'POST', body: { serial, text } }),
  pushFiles: (serial: string, localPaths: string[], remoteDir = '/sdcard/Download/') => window.rxdc.request('/api/files/push', { method: 'POST', body: { serial, localPaths, remoteDir } }),
  pullFile: (serial: string, remotePath: string, localDir: string) => window.rxdc.request('/api/files/pull', { method: 'POST', body: { serial, remotePath, localDir } }),
  pair: (address: string, code: string) => window.rxdc.request<{ ok: boolean; message: string }>('/api/pair', { method: 'POST', body: { address, code } }),
  connect: (address: string) => window.rxdc.request<{ ok: boolean; message: string }>('/api/connect', { method: 'POST', body: { address } }),
  disconnect: (address = '') => window.rxdc.request<{ ok: boolean; message: string }>('/api/disconnect', { method: 'POST', body: { address } }),
  discovery: () => window.rxdc.request<MDNSService[]>('/api/discovery'),
  activity: () => window.rxdc.request<Activity[]>('/api/activity?limit=20'),
  clearActivity: () => window.rxdc.request('/api/activity', { method: 'DELETE' })
};
