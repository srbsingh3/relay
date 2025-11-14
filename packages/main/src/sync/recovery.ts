import type { SyncErrorCode, SyncIssueAction } from '../ipc/contracts';
import type { SupportedAgent } from '../types/agents';
import { restoreBackup } from '../fs/io';

export type RecoveryEligibleCode = Extract<SyncErrorCode, 'ERR_INVALID_CONFIG' | 'ERR_PERMISSION_DENIED'>;

export interface RecoveryPromptDetails {
  agent: SupportedAgent;
  code: RecoveryEligibleCode;
  filePath?: string;
  message: string;
}

export type SyncRecoveryPrompter = (details: RecoveryPromptDetails) => Promise<SyncIssueAction>;

const resolveElectron = () => {
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-var-requires
    return require('electron') as typeof import('electron');
  } catch {
    return null;
  }
};

export const createDefaultRecoveryPrompter = (): SyncRecoveryPrompter => {
  const electron = resolveElectron();
  if (!electron) {
    return async () => 'skip_app';
  }

  const { dialog, shell } = electron;

  return async (details) => {
    const buttons = ['Open file', 'Restore backup', 'Skip app'];
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      buttons,
      defaultId: 0,
      cancelId: 2,
      title: 'Relay',
      message:
        details.code === 'ERR_INVALID_CONFIG'
          ? 'Invalid configuration file detected'
          : 'Permission issue accessing configuration file',
      detail: details.filePath ? `${details.message}\n\n${details.filePath}` : details.message,
      normalizeAccessKeys: true
    });

    const action = (['open_file', 'restore_backup', 'skip_app'] as SyncIssueAction[])[response] ?? 'skip_app';

    if (action === 'open_file' && details.filePath) {
      await shell.openPath(details.filePath);
    } else if (action === 'restore_backup' && details.filePath) {
      try {
        await restoreBackup(details.filePath);
      } catch (error) {
        console.error('[relay] failed to restore backup for "%s"', details.filePath, error);
      }
    }

    return action;
  };
};
