import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { DetectionSummary, RegistryServerEntry } from '../../../main/src/ipc/contracts';
import type { RegistryEnvironmentMap } from '../../../main/src/registry/schema';
import type { SupportedAgent } from '../../../main/src/types/agents';
import { SUPPORTED_AGENTS } from '../../../main/src/types/agents';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { cn } from '../lib/utils';

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
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-4 py-10 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-modal-title"
    >
      <div className="mx-auto flex min-h-full w-full max-w-4xl items-start justify-center">
        <div className="relative w-full rounded-[32px] border border-white/10 bg-slate-950/95 p-6 shadow-[0_40px_80px_rgba(2,6,23,0.8)]">
        <header className="flex flex-col gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Registry</p>
            <h3 className="text-2xl font-semibold text-white" id="server-modal-title">
              {title}
            </h3>
          </div>
          <Button variant="ghost" type="button" onClick={onCancel} className="text-sm uppercase tracking-[0.2em]">
            Cancel
          </Button>
        </header>
        <form className="mt-6 flex flex-col gap-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-[0.7rem] uppercase tracking-[0.25em] text-slate-400">Server name</label>
            <Input
              value={state.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="Workspace Relay"
            />
            {errors.name && <p className="text-xs text-rose-300">{errors.name}</p>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[0.7rem] uppercase tracking-[0.25em] text-slate-400">Launch command</label>
              <Input
                value={state.command}
                onChange={(event) => updateField('command', event.target.value)}
                placeholder="uvx relay serve workspace"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[0.7rem] uppercase tracking-[0.25em] text-slate-400">Args (one per line)</label>
              <Textarea
                value={state.argsText}
                onChange={(event) => updateField('argsText', event.target.value)}
                placeholder="--watch&#10;--json"
              />
            </div>
          </div>
          {errors.command && <p className="text-xs text-rose-300">{errors.command}</p>}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.25em] text-slate-400">Enabled</p>
                <p className="text-sm text-slate-300">
                  {state.enabled ? 'Server participates in sync.' : 'Server stays disabled until re-enabled.'}
                </p>
              </div>
              <button
                type="button"
                className={cn(
                  'rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em]',
                  state.enabled
                    ? 'border-emerald-400/70 bg-emerald-500/10 text-emerald-100'
                    : 'border-slate-600/70 bg-slate-800/70 text-slate-300'
                )}
                aria-pressed={state.enabled}
                onClick={() => updateField('enabled', !state.enabled)}
              >
                {state.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/30 px-4 py-4" role="group" aria-label="App scope toggles">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.25em] text-slate-400">Per-app scope</p>
                <p className="text-sm text-slate-300">Detected agents can be disabled per app.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {SUPPORTED_AGENTS.map((agent) => {
                const detected = Boolean(detection[agent]?.detected);
                const on = state.appStates[agent];
                const disabled = !detected;
                return (
                  <button
                    key={agent}
                    type="button"
                    className={cn(
                      'flex min-w-[140px] flex-col rounded-2xl border px-4 py-3 text-left text-xs uppercase tracking-[0.25em] transition',
                      on ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-slate-900/40 text-slate-200',
                      disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-white/40'
                    )}
                    disabled={disabled}
                    aria-pressed={on}
                    onClick={() => toggleApp(agent)}
                  >
                    <span className="text-[0.65rem]">{agent.charAt(0).toUpperCase() + agent.slice(1)}</span>
                    <span className="text-base font-semibold tracking-normal text-white">
                      {!detected ? 'Not detected' : on ? 'On' : 'Off'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/30 px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.25em] text-slate-400">Keychain env aliases</p>
                <p className="text-sm text-slate-400">Env key + alias (Keychain holds the secret).</p>
              </div>
              <Button variant="outline" size="sm" type="button" onClick={addEnvRow} className="rounded-full border-white/20 text-xs uppercase tracking-[0.2em]">
                Add alias
              </Button>
            </div>
            <div className="space-y-3">
              {state.envRows.map((row) => {
                const rowErrors = errors.envRows[row.id];
                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                    aria-label="Env alias row"
                  >
                    <div className="grid gap-3 md:grid-cols-[1.1fr_1fr_1fr_auto]">
                      <div className="space-y-2">
                        <label className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">Env key</label>
                        <Input
                          value={row.key}
                          onChange={(event) => updateEnvRow(row.id, { key: event.target.value })}
                          placeholder="MCP_TOKEN"
                        />
                        {rowErrors?.key && <p className="text-xs text-rose-300">{rowErrors.key}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">Alias</label>
                        <Input
                          value={row.alias}
                          onChange={(event) => updateEnvRow(row.id, { alias: event.target.value })}
                          placeholder="workspace"
                        />
                        {rowErrors?.alias && <p className="text-xs text-rose-300">{rowErrors.alias}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="text-[0.65rem] uppercase tracking-[0.25em] text-slate-400">Secret (optional)</label>
                        <Input
                          type="password"
                          value={row.secret}
                          onChange={(event) => updateEnvRow(row.id, { secret: event.target.value })}
                          placeholder="•••••••"
                        />
                        {rowErrors?.secret && <p className="text-xs text-rose-300">{rowErrors.secret}</p>}
                      </div>
                      <div className="flex items-start justify-end">
                        <button
                          type="button"
                          className="rounded-full border border-white/15 px-3 py-2 text-sm text-rose-200 transition hover:border-rose-300 hover:text-rose-100"
                          aria-label="Remove alias row"
                          onClick={() => removeEnvRow(row.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          {submissionError && (
            <div className="rounded-2xl border border-rose-400/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
              {submissionError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={onCancel} className="rounded-full border-white/15 text-xs uppercase tracking-[0.2em]">
              Cancel
            </Button>
            <Button type="submit" disabled={hasErrors || submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>
);
};

export default ServerModal;
