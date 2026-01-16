import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { app, type BrowserWindow } from 'electron';

interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const getBoundsPath = (): string => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'window-bounds.json');
};

export const loadWindowBounds = (): Partial<WindowBounds> | null => {
  try {
    const boundsPath = getBoundsPath();
    if (!existsSync(boundsPath)) {
      return null;
    }

    const data = readFileSync(boundsPath, 'utf-8');
    return JSON.parse(data) as WindowBounds;
  } catch {
    return null;
  }
};

export const saveWindowBounds = (window: BrowserWindow): void => {
  try {
    const bounds = window.getBounds();
    const boundsPath = getBoundsPath();
    const dir = path.dirname(boundsPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(boundsPath, JSON.stringify(bounds, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save window bounds:', error);
  }
};

export const trackWindowBounds = (window: BrowserWindow): void => {
  // Debounce saves to avoid excessive writes
  let saveTimeout: NodeJS.Timeout | null = null;

  const scheduleSave = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
      saveWindowBounds(window);
      saveTimeout = null;
    }, 500);
  };

  window.on('resize', scheduleSave);
  window.on('move', scheduleSave);
};
