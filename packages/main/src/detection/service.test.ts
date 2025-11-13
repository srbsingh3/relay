import { chmod, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { DetectionService } from './service';

let workspaceDir: string;

const homePath = (...segments: string[]) => path.join(workspaceDir, ...segments);

beforeEach(async () => {
  workspaceDir = await mkdtemp(path.join(os.tmpdir(), 'relay-detect-'));
});

describe('DetectionService', () => {
  it('marks Cursor detected when the ~/.cursor directory exists', async () => {
    await mkdir(homePath('.cursor'), { recursive: true });
    const service = new DetectionService({ homeDirectory: workspaceDir, pathProvider: () => '' });

    const summary = await service.refresh();

    expect(summary.cursor.detected).toBe(true);
    expect(summary.cursor.path).toBe(path.join(workspaceDir, '.cursor', 'mcp.json'));
  });

  it('marks Claude detected when the binary exists on PATH', async () => {
    const binDir = homePath('bin');
    await mkdir(binDir, { recursive: true });
    const claudeBinary = path.join(binDir, 'claude');
    await writeFile(claudeBinary, '#!/bin/sh\nexit 0\n', 'utf8');
    await chmod(claudeBinary, 0o755);

    const service = new DetectionService({ homeDirectory: workspaceDir, pathProvider: () => binDir });

    const summary = await service.refresh();

    expect(summary.claude.detected).toBe(true);
    expect(summary.claude.path).toBe(path.join(workspaceDir, '.claude.json'));
  });

  it('marks Codex detected when the config file exists', async () => {
    const codexConfig = homePath('.codex', 'config.toml');
    await mkdir(path.dirname(codexConfig), { recursive: true });
    await writeFile(codexConfig, 'profile = "relay"\n', 'utf8');

    const service = new DetectionService({ homeDirectory: workspaceDir, pathProvider: () => '' });

    const summary = await service.refresh();

    expect(summary.codex.detected).toBe(true);
    expect(summary.codex.path).toBe(codexConfig);
  });

  it('never mutates existing config files when running detection', async () => {
    const cursorConfig = homePath('.cursor', 'mcp.json');
    await mkdir(path.dirname(cursorConfig), { recursive: true });
    const sentinel = JSON.stringify({ secret: 'never-touch-me' });
    await writeFile(cursorConfig, sentinel, 'utf8');

    const service = new DetectionService({ homeDirectory: workspaceDir, pathProvider: () => '' });

    await service.refresh();

    const contents = await readFile(cursorConfig, 'utf8');
    expect(contents).toBe(sentinel);
  });

  it('reports status and resolved paths for every supported agent even when undetected', async () => {
    const service = new DetectionService({ homeDirectory: workspaceDir, pathProvider: () => '' });

    const summary = await service.refresh();

    expect(Object.keys(summary)).toEqual(expect.arrayContaining(['cursor', 'claude', 'codex']));
    expect(summary.cursor.path).toBe(path.join(workspaceDir, '.cursor', 'mcp.json'));
    expect(summary.claude.path).toBe(path.join(workspaceDir, '.claude.json'));
    expect(summary.codex.path).toBe(path.join(workspaceDir, '.codex', 'config.toml'));
    expect(summary.cursor.detected).toBe(false);
    expect(summary.claude.detected).toBe(false);
    expect(summary.codex.detected).toBe(false);
  });

  it('caches detection results until force-refreshed', async () => {
    await mkdir(homePath('.cursor'), { recursive: true });
    let tick = 0;
    const service = new DetectionService({
      homeDirectory: workspaceDir,
      pathProvider: () => '',
      now: () => new Date(1_700_000_000_000 + tick++ * 1_000)
    });

    const first = await service.getSummary();
    const second = await service.getSummary();
    expect(second.cursor.lastChecked).toBe(first.cursor.lastChecked);

    const refreshed = await service.getSummary({ force: true });
    expect(refreshed.cursor.lastChecked).not.toBe(first.cursor.lastChecked);
  });
});
