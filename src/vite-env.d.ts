/// <reference types="vite/client" />

type RxdcRequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  responseType?: 'json' | 'dataUrl';
};

type RxdcAppInfo = {
  version: string;
  platform: string;
  arch: string;
  darkMode: boolean;
  logsPath: string;
};

declare global {
  interface Window {
    rxdc: {
      request<T = unknown>(path: string, options?: RxdcRequestOptions): Promise<T>;
      selectFiles(): Promise<string[]>;
      selectFolder(): Promise<string | null>;
      appInfo(): Promise<RxdcAppInfo>;
      openLogs(): Promise<string>;
      onBackendExit(callback: (payload: { code: number | null; signal: string | null }) => void): () => void;
    };
  }
}

export {};
