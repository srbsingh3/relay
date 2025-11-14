import { mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { atomicWrite, ensureDir, restoreBackup } from './io';

let workspaceDir: string;

const tempPath = (fileName: string) => path.join(workspaceDir, fileName);

beforeEach(async () => {
  workspaceDir = await mkdtemp(path.join(os.tmpdir(), 'relay-io-'));
});

describe('fs/io helpers', () => {
  it('ensureDir creates nested directories', async () => {
    const nestedDir = tempPath(path.join('nested', 'dir'));
    await ensureDir(nestedDir);

    const stats = await stat(nestedDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('creates new files atomically without a backup', async () => {
    const targetFile = tempPath('fresh.json');

    await atomicWrite(targetFile, JSON.stringify({ hello: 'world' }));

    const contents = await readFile(targetFile, 'utf8');
    expect(contents).toBe('{"hello":"world"}');
    await expect(stat(`${targetFile}.bak`)).rejects.toThrow();
  });

  it('overwrites files and writes .bak backups', async () => {
    const targetFile = tempPath('existing.json');
    await ensureDir(path.dirname(targetFile));
    await writeFile(targetFile, '{"original":true}', 'utf8');

    await atomicWrite(targetFile, '{"mutated":true}');

    const contents = await readFile(targetFile, 'utf8');
    expect(contents).toBe('{"mutated":true}');

    const backupContents = await readFile(`${targetFile}.bak`, 'utf8');
    expect(backupContents).toBe('{"original":true}');
  });

  it('restores the previous backup when requested', async () => {
    const targetFile = tempPath('restore.json');
    await ensureDir(path.dirname(targetFile));
    await writeFile(targetFile, '{"initial":true}', 'utf8');

    await atomicWrite(targetFile, '{"mutated":true}');
    await restoreBackup(targetFile);

    const contents = await readFile(targetFile, 'utf8');
    expect(contents).toBe('{"initial":true}');
  });

  it('cleans up tmp files when the rename fails', async () => {
    const targetFile = tempPath('error-target');
    await ensureDir(targetFile); // create directory so rename fails with EISDIR

    await expect(atomicWrite(targetFile, 'data')).rejects.toThrow();

    const entries = await readdir(path.dirname(targetFile));
    const tmpEntries = entries.filter((entry) => entry.includes('.tmp-'));
    expect(tmpEntries).toHaveLength(0);
  });
});
