import type { RendererBridge } from '../../main/src/ipc/contracts';

declare global {
  interface Window {
    relay?: RendererBridge;
  }
}

export {};
