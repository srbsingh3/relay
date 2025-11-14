import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';

export type AtomicWriteContent = string | NodeJS.ArrayBufferView;

const normalizeContent = (input: AtomicWriteContent): string | Uint8Array => {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof Uint8Array) {
    return input;
  }

  return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
};

export const ensureDir = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
};

const uniqueTmpPath = (filePath: string) => {
  const suffix = randomBytes(6).toString('hex');
  return `${filePath}.tmp-${suffix}`;
};

export const atomicWrite = async (filePath: string, content: AtomicWriteContent) => {
  const directory = path.dirname(filePath);
  await ensureDir(directory);

  const tmpPath = uniqueTmpPath(filePath);
  const backupPath = `${filePath}.bak`;

  let tmpHandle: fs.FileHandle | null = null;

  try {
    tmpHandle = await fs.open(tmpPath, 'w');
    await tmpHandle.writeFile(normalizeContent(content));
    await tmpHandle.sync();
    await tmpHandle.close();
    tmpHandle = null;

    if (await fileExists(filePath)) {
      await fs.copyFile(filePath, backupPath);
    }

    await fs.rename(tmpPath, filePath);
  } finally {
    if (tmpHandle) {
      await tmpHandle.close().catch(() => {
        // best-effort close to avoid dangling descriptors
      });
    }

    await fs.rm(tmpPath, { force: true }).catch(() => {
      // ignore cleanup failures
    });
  }
};

export const restoreBackup = async (filePath: string) => {
  const backupPath = `${filePath}.bak`;
  await fs.copyFile(backupPath, filePath);
};
