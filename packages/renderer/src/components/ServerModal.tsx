import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { DetectionSummary, RegistryServerEntry } from '../../../main/src/ipc/contracts';
import type { RegistryEnvironmentMap } from '../../../main/src/registry/schema';
import type { SupportedAgent } from '../../../main/src/types/agents';
import { SUPPORTED_AGENTS } from '../../../main/src/types/agents';
import { Button } from './ui/button';
import { ErrorBoundary } from './ui/error-boundary';
import { FocusTrap } from './ui/focus-trap';
import { FormField } from './ui/form-field';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { LoadingSpinner } from './ui/loading-spinner';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { Typography } from './ui/typography';
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
  const secretMap = new Map<string, string>();

  rows.forEach((row) => {
    const key = row.key.trim();
    const alias = row.alias.trim();
    const secret = row.secret.trim();

    if (!key && !alias && !secret) {
      return;
    }

    if (!key || !alias) {
      return;
    }

    env[key] = `${KEYCHAIN_VALUE_PREFIX}${alias}`;
    if (secret) {
      secretMap.set(alias, secret);
    }
  });

  const secrets = Array.from(secretMap.entries()).map(([alias, secret]) => ({
    alias,
    secret
  }));

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
  const previousServerRef = useRef<RegistryServerEntry | undefined>(server);
  const previousDetectionRef = useRef<DetectionSummary>(detection);
  const previousModeRef = useRef<typeof mode>(mode);

  useEffect(() => {
    const serverChanged = previousServerRef.current !== server;
    const modeChanged = previousModeRef.current !== mode;
    const detectionChanged = previousDetectionRef.current !== detection;

    previousServerRef.current = server;
    previousModeRef.current = mode;
    previousDetectionRef.current = detection;

    if (!serverChanged && !modeChanged && detectionChanged) {
      return;
    }

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
      className="fixed inset-0 z-50 overflow-y-auto bg-background/80 px-4 py-10 backdrop-blur-sm modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-modal-title"
    >
      <div className="mx-auto flex min-h-full w-full max-w-4xl items-start justify-center">
        <FocusTrap active onEscape={onCancel}>
          <div className="relative w-full rounded-xl border border-border bg-card p-6 modal-content animate-scale-in">
        <header className="flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Registry</p>
            <h3 className="text-2xl font-semibold text-foreground" id="server-modal-title">
              {title}
            </h3>
          </div>
          <Button variant="ghost" type="button" onClick={onCancel} className="text-sm uppercase tracking-[0.2em]">
            Cancel
          </Button>
        </header>
        <ErrorBoundary>
        <form className="mt-6 flex flex-col gap-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label variant="uppercase">Server name</Label>
            <Input
              value={state.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="Workspace Relay"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label variant="uppercase">Launch command</Label>
              <Input
                value={state.command}
                onChange={(event) => updateField('command', event.target.value)}
                placeholder="uvx relay serve workspace"
              />
            </div>
            <div className="space-y-2">
              <Label variant="uppercase">Args (one per line)</Label>
              <Textarea
                value={state.argsText}
                onChange={(event) => updateField('argsText', event.target.value)}
                placeholder="--watch&#10;--json"
              />
            </div>
          </div>
          {errors.command && <p className="text-xs text-destructive">{errors.command}</p>}
          <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Typography variant="label" color="muted">Enabled</Typography>
                <Typography variant="small">
                  {state.enabled ? 'Server participates in sync.' : 'Server stays disabled until re-enabled.'}
                </Typography>
              </div>
              <Switch
                checked={state.enabled}
                onCheckedChange={(checked) => updateField('enabled', checked)}
              />
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-muted/30 px-4 py-4" role="group" aria-label="App scope toggles">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Typography variant="label" color="muted">Per-app scope</Typography>
                <Typography variant="small">Detected agents can be disabled per app.</Typography>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {SUPPORTED_AGENTS.map((agent) => {
                const detected = Boolean(detection[agent]?.detected);
                const on = state.appStates[agent];
                const disabled = !detected;
                return (
                  <div
                    key={agent}
                    className={cn(
                      'flex items-center justify-between rounded-lg border border-border bg-card p-3',
                      !detected && 'opacity-50'
                    )}
                  >
                    <div className="flex-1">
                      <Typography variant="eyebrow" color="muted">
                        {agent.charAt(0).toUpperCase() + agent.slice(1)}
                      </Typography>
                      <Typography variant="small" color="default">
                        {!detected ? 'Not detected' : on ? 'Enabled' : 'Disabled'}
                      </Typography>
                    </div>
                    <Switch
                      checked={on}
                      onCheckedChange={() => toggleApp(agent)}
                      disabled={disabled}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <section className="space-y-4 rounded-3xl border border-border bg-muted/30 px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Typography variant="label" color="muted">Keychain env aliases</Typography>
                <p className="text-sm text-muted-foreground">Env key + alias (Keychain holds the secret).</p>
              </div>
              <Button variant="outline" size="sm" type="button" onClick={addEnvRow} className="rounded-full border-border/20 text-xs uppercase tracking-[0.2em]">
                Add alias
              </Button>
            </div>
            <div className="space-y-3">
              {state.envRows.map((row) => {
                const rowErrors = errors.envRows[row.id];
                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-border bg-card/90 p-4"
                    aria-label="Env alias row"
                  >
                    <div className="grid gap-3 md:grid-cols-[1.1fr_1fr_1fr_auto]">
                      <div className="space-y-2">
                        <Label variant="uppercase">Env key</Label>
                        <Input
                          value={row.key}
                          onChange={(event) => updateEnvRow(row.id, { key: event.target.value })}
                          placeholder="MCP_TOKEN"
                        />
                        {rowErrors?.key && <p className="text-xs text-destructive">{rowErrors.key}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label variant="uppercase">Alias</Label>
                        <Input
                          value={row.alias}
                          onChange={(event) => updateEnvRow(row.id, { alias: event.target.value })}
                          placeholder="workspace"
                        />
                        {rowErrors?.alias && <p className="text-xs text-destructive">{rowErrors.alias}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label variant="uppercase">Secret (optional)</Label>
                        <Input
                          type="password"
                          value={row.secret}
                          onChange={(event) => updateEnvRow(row.id, { secret: event.target.value })}
                          placeholder="•••••••"
                        />
                        {rowErrors?.secret && <p className="text-xs text-destructive">{rowErrors.secret}</p>}
                      </div>
                      <div className="flex items-start justify-end">
                        <button
                          type="button"
                          className="rounded-full border border-border/15 px-3 py-2 text-sm text-destructive transition hover:border-destructive/80 hover:text-destructive"
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
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {submissionError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={onCancel} className="rounded-full border-border/15 text-xs uppercase tracking-[0.2em]">
              Cancel
            </Button>
            <Button type="submit" disabled={hasErrors || submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
        </ErrorBoundary>
      </div>
        </FocusTrap>
      </div>
    </div>
  </div>
);
};

export default ServerModal;
