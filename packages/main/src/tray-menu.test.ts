import type { BrowserWindow } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { buildTrayMenuTemplate } from './tray-menu';

const fakeWindow = {} as BrowserWindow;

describe('buildTrayMenuTemplate', () => {
  it('creates Open Relay, Sync Now, and Quit entries', () => {
    const showOrCreateWindow = vi.fn(() => fakeWindow);
    const syncNow = vi.fn();

    const template = buildTrayMenuTemplate(showOrCreateWindow, syncNow);
    const labels = template.map((entry) => entry.label).filter(Boolean);

    expect(labels).toEqual(['Open Relay', 'Sync Now', 'Quit']);

    template[0]?.click?.({} as any, fakeWindow, {} as any);
    expect(showOrCreateWindow).toHaveBeenCalledTimes(1);

    template[1]?.click?.({} as any, fakeWindow, {} as any);
    expect(syncNow).toHaveBeenCalledTimes(1);
  });
});
