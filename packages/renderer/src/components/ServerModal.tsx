import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { DetectionSummary, RegistryServerEntry } from '../../../main/src/ipc/contracts';
import type { RegistryEnvironmentMap } from '../../../main/src/registry/schema';
import type { SupportedAgent } from '../../../main/src/types/agents';
import { SUPPORTED_AGENTS } from '../../../main/src/types/agents';

const KEYCHAIN_VALUE_PREFIX = 'keychain:';

interface EnvRow {
  id: string;
  key: string;
  alias: string;
  secret: string;
}

interface EnvRowErrors {
  key?: string;
  alias?: string;
  secret?: string;
}

interface FormErrors {
  name?: string;
  command?: string;
  envRows: Record<string, EnvRowErrors>;
}

const createEnvRow = (seed?: Partial<EnvRow>): EnvRow => ({
  id: seed?.id ?? `env-${Math.random().toString(36).slice(2)}`,
  key: seed?.key ?? '',
  alias: seed?.alias ?? '',
  secret: seed?.secret ?? ''
});

const extractAlias = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith(KEYCHAIN_VALUE_PREFIX)) {
    return '';
  }

  const alias = trimmed.slice(KEYCHAIN_VALUE_PREFIX.length).trim();
  return alias;
};

const buildEnvRowsFromMap = (env?: RegistryEnvironmentMap): EnvRow[] => {
  if (!env) {
    return [createEnvRow()];
  }

  const entries = Object.entries(env);
  if (entries.length === 0) {
    return [createEnvRow()];
  }

  return entries.map(([key, value]) =>
    createEnvRow({
      key,
      alias: typeof value === 'string' ? extractAlias(value) || value : '',
      secret: ''
    })
  );
};

const parseArgsText = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((arg) => arg.trim())
    .filter((arg) => arg.length > 0);

const buildInitialAppStates = (
  server: RegistryServerEntry | undefined,
  detection: DetectionSummary
): Record<SupportedAgent, boolean> => {
  return SUPPORTED_AGENTS.reduce<Record<SupportedAgent, boolean>>((acc, agent) => {
    const detected = Boolean(detection[agent]?.detected);
    const existing = server ? server.apps?.[agent] !== false : true;
    acc[agent] = detected ? existing : false;
    return acc;
  }, {} as Record<SupportedAgent, boolean>);
};

const normalizeEnvRows = (rows: EnvRow[]) => {
  const env: RegistryEnvironmentMap = {};
  const secrets: { alias: string; secret: string }[] = [];

  rows.forEach((row) => {
    const key = row.key.trim();
    const alias = row.alias.trim();
    const secret = row.secret.trim();

    if (!key && !alias && !secret) {
      return;
    }

    if (key && alias) {
      env[key] = `${KEYCHAIN_VALUE_PREFIX}${alias}`;
      if (secret) {
        secrets.push({ alias, secret });
      }
    }
  });

  return { env, secrets };
};

export const serializeEnvRows = normalizeEnvRows;
export type { EnvRow };

export interface ServerFormSubmitPayload {
  mode: 'add' | 'edit';
  serverId?: string;
  data: {
    name: string;
    enabled: boolean;
    launch: {
      command: string;
      args: string[];
    };
    env: RegistryEnvironmentMap;
    apps?: RegistryServerEntry['apps'];
  };
  secrets: { alias: string; secret: string }[];
}

interface ServerModalProps {
  mode: 'add' | 'edit';
  server?: RegistryServerEntry;
  detection: DetectionSummary;
  existingServers: RegistryServerEntry[];
  onCancel: () => void;
  onSubmit: (payload: ServerFormSubmitPayload) => Promise<void> | void;
}

interface ServerFormState {
  name: string;
  command: string;
  argsText: string;
  enabled: boolean;
  appStates: Record<SupportedAgent, boolean>;
  envRows: EnvRow[];
}

const buildInitialFormState = (
  server: RegistryServerEntry | undefined,
  detection: DetectionSummary
): ServerFormState => ({
  name: server?.name ?? '',
  command: server?.launch.command ?? '',
  argsText: server?.launch.args?.join('\n') ?? '',
  enabled: server?.enabled ?? true,
  appStates: buildInitialAppStates(server, detection),
  envRows: buildEnvRowsFromMap(server?.env)
});

const validateForm = (
  state: ServerFormState,
  existingServers: RegistryServerEntry[],
  editingId?: string
): { errors: FormErrors; hasErrors: boolean } => {
  const errors: FormErrors = { envRows: {} };
  const name = state.name.trim();
  const command = state.command.trim();

  if (!name) {
    errors.name = 'Server name is required.';
  } else {
    const normalized = name.toLowerCase();
    const taken = existingServers.some(
      (server) => server.id !== editingId && server.name.trim().toLowerCase() === normalized
    );
    if (taken) {
      errors.name = 'Another server already uses this name.';
    }
  }

  if (!command) {
    errors.command = 'Launch command is required.';
  }

  state.envRows.forEach((row) => {
    const key = row.key.trim();
    const alias = row.alias.trim();
    const secret = row.secret.trim();

    if (!key && !alias && !secret) {
      return;
    }

    const rowErrors: EnvRowErrors = {};
    if (!key) {
      rowErrors.key = 'Env key is required.';
    }

    if (!alias) {
      rowErrors.alias = 'Alias is required.';
    }

    if (secret && !alias) {
      rowErrors.secret = 'Alias is required before adding a secret.';
    }

    if (Object.keys(rowErrors).length > 0) {
      errors.envRows[row.id] = rowErrors;
    }
  });

  const hasErrors = Boolean(errors.name || errors.command || Object.keys(errors.envRows).length > 0);
  return { errors, hasErrors };
};

const ServerModal = ({
  mode,
  server,
  detection,
  existingServers,
  onCancel,
  onSubmit
}: ServerModalProps) => {
  const [state, setState] = useState<ServerFormState>(() => buildInitialFormState(server, detection));
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    setState(buildInitialFormState(server, detection));
    setSubmitting(false);
    setSubmissionError(null);
  }, [server, detection, mode]);

  const { errors, hasErrors } = useMemo(
    () => validateForm(state, existingServers, server?.id),
    [state, existingServers, server?.id]
  );

  const updateField = (key: keyof ServerFormState, value: string | boolean | EnvRow[]) => {
    setState((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const toggleApp = (agent: SupportedAgent) => {
    if (!detection[agent]?.detected) {
      return;
    }

    setState((prev) => ({
      ...prev,
      appStates: {
        ...prev.appStates,
        [agent]: !prev.appStates[agent]
      }
    }));
  };

  const addEnvRow = () => {
    setState((prev) => ({
      ...prev,
      envRows: [...prev.envRows, createEnvRow()]
    }));
  };

  const updateEnvRow = (id: string, patch: Partial<EnvRow>) => {
    setState((prev) => ({
      ...prev,
      envRows: prev.envRows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    }));
  };

  const removeEnvRow = (id: string) => {
    setState((prev) => ({
      ...prev,
      envRows: prev.envRows.filter((row) => row.id !== id)
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (hasErrors || submitting) {
      return;
    }

    setSubmissionError(null);
    setSubmitting(true);

    const { env, secrets } = normalizeEnvRows(state.envRows);
    const apps = SUPPORTED_AGENTS.reduce<RegistryServerEntry['apps']>((acc, agent) => {
      if (!state.appStates[agent]) {
        acc[agent] = false;
      }
      return acc;
    }, {} as RegistryServerEntry['apps']);
    const normalizedApps = Object.keys(apps).length > 0 ? apps : undefined;

    try {
      await onSubmit({
        mode,
        serverId: server?.id,
        data: {
          name: state.name.trim(),
          enabled: state.enabled,
          launch: {
            command: state.command.trim(),
            args: parseArgsText(state.argsText)
          },
          env,
          apps: normalizedApps
        },
        secrets
      });
    } catch (error) {
      console.error('[relay] server modal submission failed', error);
      setSubmissionError(error instanceof Error ? error.message : 'Unable to save server changes.');
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === 'add' ? 'Add server' : `Edit ${server?.name ?? 'server'}`;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="server-modal-title">
      <div className="modal-panel">
        <header className="modal-header">
          <div>
            <p className="section-eyebrow">Registry</p>
            <h3 id="server-modal-title">{title}</h3>
          </div>
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        </header>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label>
              <span className="field-label">Server name</span>
              <input
                type="text"
                value={state.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Workspace Relay"
              />
            </label>
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>
          <div className="command-grid">
            <label>
              <span className="field-label">Launch command</span>
              <input
                type="text"
                value={state.command}
                onChange={(event) => updateField('command', event.target.value)}
                placeholder="uvx relay serve workspace"
              />
            </label>
            <label>
              <span className="field-label">Args (one per line)</span>
              <textarea
                value={state.argsText}
                onChange={(event) => updateField('argsText', event.target.value)}
                placeholder="--watch&#10;--json"
                rows={4}
              />
            </label>
          </div>
          {errors.command && <p className="field-error">{errors.command}</p>}
          <div className="toggle-cluster">
            <span className="field-label">Enabled</span>
            <button
              type="button"
              className={`switch ${state.enabled ? 'switch--on' : 'switch--off'}`}
              onClick={() => updateField('enabled', !state.enabled)}
              aria-pressed={state.enabled}
            >
              {state.enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          <div className="apps-row modal-apps" role="group" aria-label="App scope toggles">
            {SUPPORTED_AGENTS.map((agent) => {
              const detected = Boolean(detection[agent]?.detected);
              const disabled = !detected;
              const on = state.appStates[agent];
              return (
                <button
                  key={agent}
                  type="button"
                  className={`app-pill ${on ? 'app-pill--on' : 'app-pill--off'} ${disabled ? 'app-pill--disabled' : ''}`}
                  disabled={disabled}
                  onClick={() => toggleApp(agent)}
                  aria-pressed={on}
                >
                  <span className="pill-label">{agent.charAt(0).toUpperCase() + agent.slice(1)}</span>
                  <span className="pill-state">{detected ? (on ? 'On' : 'Off') : 'Not detected'}</span>
                </button>
              );
            })}
          </div>
          <section className="env-section">
            <div className="env-header">
              <div>
                <p className="field-label">Keychain env aliases</p>
                <p className="field-hint">Provide env key + alias; secrets stay in Keychain.</p>
              </div>
              <button type="button" className="ghost-button" onClick={addEnvRow}>
                Add alias
              </button>
            </div>
            <div className="env-rows">
              {state.envRows.map((row) => {
                const rowErrors = errors.envRows[row.id];
                return (
                  <div className="env-row" key={row.id}>
                    <label>
                      <span className="field-label">Env key</span>
                      <input
                        type="text"
                        value={row.key}
                        onChange={(event) => updateEnvRow(row.id, { key: event.target.value })}
                        placeholder="MCP_TOKEN"
                      />
                      {rowErrors?.key && <span className="field-error">{rowErrors.key}</span>}
                    </label>
                    <label>
                      <span className="field-label">Alias</span>
                      <input
                        type="text"
                        value={row.alias}
                        onChange={(event) => updateEnvRow(row.id, { alias: event.target.value })}
                        placeholder="workspace"
                      />
                      {rowErrors?.alias && <span className="field-error">{rowErrors.alias}</span>}
                    </label>
                    <label>
                      <span className="field-label">Secret (optional)</span>
                      <input
                        type="password"
                        value={row.secret}
                        onChange={(event) => updateEnvRow(row.id, { secret: event.target.value })}
                        placeholder="•••••••"
                      />
                      {rowErrors?.secret && <span className="field-error">{rowErrors.secret}</span>}
                    </label>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Remove alias row"
                      onClick={() => removeEnvRow(row.id)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
          {submissionError && <p className="inline-error">{submissionError}</p>}
          <div className="modal-actions">
            <button type="submit" className="primary-button" disabled={hasErrors || submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServerModal;
