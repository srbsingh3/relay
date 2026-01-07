import { describe, expect, it } from 'vitest';
import { buildMainWindowOptions } from './window-options';

const baseArgs = {
  preloadPath: '/tmp/preload.js',
  isMac: false,
  allowDevTools: false
};

describe('buildMainWindowOptions', () => {
  it('enforces critical security flags', () => {
    const options = buildMainWindowOptions(baseArgs);

    expect(options.webPreferences?.contextIsolation).toBe(true);
    expect(options.webPreferences?.nodeIntegration).toBe(false);
    expect(options.webPreferences?.sandbox).toBe(true);
    expect(options.webPreferences?.preload).toBe(baseArgs.preloadPath);
    expect(options.webPreferences?.devTools).toBe(false);
  });

  it('enables window chrome defaults', () => {
    const options = buildMainWindowOptions(baseArgs);

    expect(options.width).toBe(1100);
    expect(options.height).toBe(700);
    expect(options.transparent).toBe(true);
    expect(options.titleBarStyle).toBe('hiddenInset');
  });

  it('adds macOS-specific chrome when requested', () => {
    const options = buildMainWindowOptions({ ...baseArgs, isMac: true });

    expect(options.trafficLightPosition).toEqual({ x: 16, y: 18 });
    expect(options.vibrancy).toBe('under-window');
    expect(options.visualEffectState).toBe('active');
  });

  it('propagates devtools allowance when needed', () => {
    const options = buildMainWindowOptions({ ...baseArgs, allowDevTools: true });
    expect(options.webPreferences?.devTools).toBe(true);
  });
});
