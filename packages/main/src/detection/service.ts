import { constants as fsConstants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { DetectionStatus, DetectionSummary } from '../ipc/contracts';
import { SUPPORTED_AGENTS, type SupportedAgent } from '../types/agents';

const { X_OK } = fsConstants;

const isEnoent = (error: unknown): boolean =>
  (error as NodeJS.ErrnoException)?.code === 'ENOENT';

const pathExists = async (target: string): Promise<boolean> => {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (isEnoent(error)) {
      return false;
    }

    console.warn('[relay] detection: unable to access path "%s"', target, error);
    return false;
  }
};

const isExecutableFile = async (target: string): Promise<boolean> => {
  try {
    await access(target, X_OK);
    const descriptor = await stat(target);
    return descriptor.isFile();
  } catch (error) {
    if (!isEnoent(error)) {
      // Non-existent files are common; only warn on other errors to avoid log spam.
      console.warn('[relay] detection: unable to inspect executable "%s"', target, error);
    }
    return false;
  }
};

const findExecutableInPath = async (binaryName: string, pathValue: string): Promise<string | null> => {
  if (!pathValue) {
    return null;
  }

  const candidates = pathValue.split(path.delimiter).filter(Boolean);
  for (const folder of candidates) {
    const candidatePath = path.join(folder, binaryName);
    if (await isExecutableFile(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
};

export interface DetectionServiceOptions {
  homeDirectory?: string;
  pathProvider?: () => string;
  now?: () => Date;
}

type AgentSummaryEntries = [SupportedAgent, DetectionStatus];

type AgentDetectionChecks = Record<SupportedAgent, () => Promise<boolean>>;

export class DetectionService {
  private readonly homeDirectory: string;
  private readonly configPaths: Record<SupportedAgent, string>;
  private readonly pathProvider: () => string;
  private readonly now: () => Date;
  private summary: DetectionSummary | null = null;
  private inflight: Promise<DetectionSummary> | null = null;

  constructor(options: DetectionServiceOptions = {}) {
    this.homeDirectory = options.homeDirectory ?? os.homedir();
    // VS Code extensions storage path on macOS
    const vscodeGlobalStorage = path.join(
      this.homeDirectory,
      'Library',
      'Application Support',
      'Code',
      'User',
      'globalStorage'
    );
    this.configPaths = {
      cursor: path.join(this.homeDirectory, '.cursor', 'mcp.json'),
      claude: path.join(this.homeDirectory, '.claude.json'),
      codex: path.join(this.homeDirectory, '.codex', 'config.toml'),
      cline: path.join(vscodeGlobalStorage, 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
      roo: path.join(vscodeGlobalStorage, 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
      kilo: path.join(vscodeGlobalStorage, 'kilocode.kilo-code', 'settings', 'mcp_settings.json'),
      opencode: path.join(this.homeDirectory, '.config', 'opencode', 'opencode.json'),
      antigravity: path.join(this.homeDirectory, '.gemini', 'antigravity', 'mcp_config.json'),
    };
    this.pathProvider = options.pathProvider ?? (() => process.env.PATH ?? '');
    this.now = options.now ?? (() => new Date());
  }

  async getSummary(options?: { force?: boolean }): Promise<DetectionSummary> {
    if (!options?.force) {
      if (this.summary) {
        return this.summary;
      }

      if (!this.inflight) {
        this.inflight = this.computeSummary().finally(() => {
          this.inflight = null;
        });
      }

      return this.inflight;
    }

    const summary = await this.computeSummary();
    this.summary = summary;
    return summary;
  }

  async refresh(): Promise<DetectionSummary> {
    return this.getSummary({ force: true });
  }

  clearCache() {
    this.summary = null;
  }

  private detectionChecks(): AgentDetectionChecks {
    return {
      cursor: async () =>
        (await pathExists(path.join(this.homeDirectory, '.cursor'))) || (await pathExists(this.configPaths.cursor)),
      claude: async () =>
        (await pathExists(this.configPaths.claude)) || Boolean(await findExecutableInPath('claude', this.pathProvider())),
      codex: async () =>
        (await pathExists(this.configPaths.codex)) || Boolean(await findExecutableInPath('codex', this.pathProvider())),
      // VS Code extensions: detect by extension folder or config file
      cline: async () =>
        (await pathExists(this.configPaths.cline)) ||
        (await pathExists(path.dirname(path.dirname(this.configPaths.cline)))), // extension folder
      roo: async () =>
        (await pathExists(this.configPaths.roo)) ||
        (await pathExists(path.dirname(path.dirname(this.configPaths.roo)))), // extension folder
      kilo: async () =>
        (await pathExists(this.configPaths.kilo)) ||
        (await pathExists(path.dirname(path.dirname(this.configPaths.kilo)))), // extension folder
      // CLI tools: detect by config file or binary in PATH
      opencode: async () =>
        (await pathExists(this.configPaths.opencode)) ||
        Boolean(await findExecutableInPath('opencode', this.pathProvider())),
      // Antigravity: detect by config file or .app bundle
      antigravity: async () =>
        (await pathExists(this.configPaths.antigravity)) ||
        (await pathExists(path.join(this.homeDirectory, '.gemini', 'antigravity'))),
    };
  }

  private async computeSummary(): Promise<DetectionSummary> {
    const checks = this.detectionChecks();
    const evaluations = await Promise.all(
      SUPPORTED_AGENTS.map(async (agent): Promise<AgentSummaryEntries> => {
        const detected = await checks[agent]();
        return [
          agent,
          {
            detected,
            path: this.configPaths[agent],
            lastChecked: this.now().toISOString()
          }
        ];
      })
    );

    const summary = evaluations.reduce<DetectionSummary>((acc, [agent, status]) => {
      acc[agent] = status;
      return acc;
    }, {} as DetectionSummary);

    this.summary = summary;
    return summary;
  }
}

const defaultService = new DetectionService();

export const getDetectionService = () => defaultService;
