import { useState, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { TypeBadge, type ServerType } from '../shared/TypeBadge';
import { Button } from '../ui/button';

interface DetectedPlaceholder {
  key: string;
  location: 'headers' | 'env' | 'args';
  originalValue: string;
}

interface ParsedServer {
  name: string;
  type: ServerType;
  url?: string;
  command?: string;
  args?: string[];
  headers?: Record<string, string>;
  env?: Record<string, string>;
  placeholders: DetectedPlaceholder[];
}

interface AddServerFlowProps {
  onComplete: (server: ParsedServer, secrets: Record<string, string>) => void;
  onCancel: () => void;
}

type Step = 'paste' | 'secrets' | 'preview';

// Placeholder patterns to detect
const PLACEHOLDER_PATTERNS = [
  /^YOUR_[A-Z_]+$/,
  /^<[a-z-]+>$/,
  /^REPLACE_?ME$/i,
  /^CHANGEME$/i,
  /^XXX+$/,
  /^[A-Z_]+_KEY$/,
  /^[A-Z_]+_TOKEN$/,
  /^[A-Z_]+_SECRET$/,
  /^\[.*\]$/,
  /^\{.*\}$/,
];

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function parseConfigJSON(input: string): { server: ParsedServer; error: string | null } {
  try {
    const parsed = JSON.parse(input);

    // Handle { mcpServers: { name: config } } format
    if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
      const entries = Object.entries(parsed.mcpServers);
      if (entries.length === 0) {
        return { server: null as any, error: 'No servers found in mcpServers object' };
      }

      const [name, config] = entries[0] as [string, any];
      const placeholders: DetectedPlaceholder[] = [];

      // Detect type
      const type: ServerType = config.url ? 'url' : 'command';

      // Scan for placeholders
      if (config.headers) {
        Object.entries(config.headers).forEach(([key, value]) => {
          if (typeof value === 'string' && isPlaceholder(value)) {
            placeholders.push({ key, location: 'headers', originalValue: value });
          }
        });
      }

      if (config.env) {
        Object.entries(config.env).forEach(([key, value]) => {
          if (typeof value === 'string' && isPlaceholder(value)) {
            placeholders.push({ key, location: 'env', originalValue: value });
          }
        });
      }

      if (config.args && Array.isArray(config.args)) {
        config.args.forEach((arg: string, index: number) => {
          if (typeof arg === 'string' && isPlaceholder(arg)) {
            placeholders.push({
              key: `arg_${index}`,
              location: 'args',
              originalValue: arg,
            });
          }
          // Also check for patterns like "--api-key" followed by placeholder
          if (typeof arg === 'string' && arg.includes('=')) {
            const [key, value] = arg.split('=');
            if (value && isPlaceholder(value)) {
              placeholders.push({
                key: key.replace(/^-+/, ''),
                location: 'args',
                originalValue: value,
              });
            }
          }
        });
      }

      return {
        server: {
          name,
          type,
          url: config.url,
          command: config.command,
          args: config.args,
          headers: config.headers,
          env: config.env,
          placeholders,
        },
        error: null,
      };
    }

    return { server: null as any, error: 'Invalid format. Expected { mcpServers: { ... } }' };
  } catch (e) {
    return { server: null as any, error: 'Invalid JSON syntax' };
  }
}

export function AddServerFlow({ onComplete, onCancel }: AddServerFlowProps) {
  const [step, setStep] = useState<Step>('paste');
  const [input, setInput] = useState('');
  const [parsedServer, setParsedServer] = useState<ParsedServer | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Parse on input change
  useEffect(() => {
    if (!input.trim()) {
      setParsedServer(null);
      setParseError(null);
      return;
    }

    const { server, error } = parseConfigJSON(input);
    setParsedServer(server);
    setParseError(error);

    // Initialize secrets state for placeholders
    if (server?.placeholders) {
      const initialSecrets: Record<string, string> = {};
      server.placeholders.forEach((p) => {
        initialSecrets[p.key] = '';
      });
      setSecrets(initialSecrets);
    }
  }, [input]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Let the paste happen naturally
  }, []);

  const canProceedToSecrets = parsedServer && !parseError;
  const canProceedToPreview =
    parsedServer &&
    parsedServer.placeholders.every((p) => secrets[p.key]?.trim());
  const hasPlaceholders = parsedServer?.placeholders && parsedServer.placeholders.length > 0;

  const handleNext = () => {
    if (step === 'paste' && canProceedToSecrets) {
      if (hasPlaceholders) {
        setStep('secrets');
      } else {
        setStep('preview');
      }
    } else if (step === 'secrets' && canProceedToPreview) {
      setStep('preview');
    } else if (step === 'preview' && parsedServer) {
      onComplete(parsedServer, secrets);
    }
  };

  const handleBack = () => {
    if (step === 'secrets') {
      setStep('paste');
    } else if (step === 'preview') {
      if (hasPlaceholders) {
        setStep('secrets');
      } else {
        setStep('paste');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Add Server</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === 'paste' && 'Paste your MCP server configuration'}
                {step === 'secrets' && 'Enter your API keys and secrets'}
                {step === 'preview' && 'Review and confirm'}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mt-4">
            {['paste', 'secrets', 'preview'].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && (
                  <div
                    className={cn(
                      'w-8 h-px',
                      step === s || (step === 'preview' && s !== 'preview')
                        ? 'bg-foreground/30'
                        : 'bg-border'
                    )}
                  />
                )}
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                    step === s
                      ? 'bg-foreground text-background'
                      : s === 'secrets' && !hasPlaceholders
                      ? 'bg-muted text-muted-foreground/50'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Paste */}
          {step === 'paste' && (
            <div className="space-y-4">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handlePaste}
                placeholder={`Paste your MCP config JSON here...

Example:
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@example/mcp"]
    }
  }
}`}
                className={cn(
                  'w-full h-48 px-4 py-3 rounded-lg border bg-background font-mono text-sm resize-none',
                  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
                  'placeholder:text-muted-foreground/50',
                  parseError ? 'border-destructive' : 'border-input'
                )}
                autoFocus
              />

              {parseError && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z" />
                  </svg>
                  {parseError}
                </p>
              )}

              {parsedServer && !parseError && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-success">
                    <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-.997-6l7.07-7.071-1.414-1.414-5.656 5.657-2.829-2.829-1.414 1.414L11.003 16z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      Found: {parsedServer.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {parsedServer.type === 'url' ? 'URL-based' : 'Command-based'} server
                      {parsedServer.placeholders.length > 0 &&
                        ` with ${parsedServer.placeholders.length} secret${parsedServer.placeholders.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <TypeBadge type={parsedServer.type} />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Secrets */}
          {step === 'secrets' && parsedServer && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We detected {parsedServer.placeholders.length} placeholder
                {parsedServer.placeholders.length > 1 ? 's' : ''} in your config.
                Enter the actual values below.
              </p>

              <div className="space-y-3">
                {parsedServer.placeholders.map((placeholder) => (
                  <div key={placeholder.key} className="space-y-1.5">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {placeholder.key}
                      <span className="text-xs text-muted-foreground font-normal">
                        ({placeholder.location})
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets[placeholder.key] ? 'text' : 'password'}
                        value={secrets[placeholder.key] || ''}
                        onChange={(e) =>
                          setSecrets((prev) => ({
                            ...prev,
                            [placeholder.key]: e.target.value,
                          }))
                        }
                        placeholder={placeholder.originalValue}
                        className={cn(
                          'w-full h-10 px-3 pr-10 rounded-lg border border-input bg-background text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
                          'placeholder:text-muted-foreground/40'
                        )}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowSecrets((prev) => ({
                            ...prev,
                            [placeholder.key]: !prev[placeholder.key],
                          }))
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showSecrets[placeholder.key] ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && parsedServer && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {parsedServer.name}
                  </h3>
                  <TypeBadge type={parsedServer.type} />
                </div>

                <div className="space-y-2 text-xs">
                  {parsedServer.type === 'url' && parsedServer.url && (
                    <div>
                      <span className="text-muted-foreground">URL:</span>{' '}
                      <span className="font-mono text-foreground">{parsedServer.url}</span>
                    </div>
                  )}
                  {parsedServer.type === 'command' && parsedServer.command && (
                    <div>
                      <span className="text-muted-foreground">Command:</span>{' '}
                      <span className="font-mono text-foreground">
                        {parsedServer.command} {parsedServer.args?.join(' ')}
                      </span>
                    </div>
                  )}
                  {parsedServer.placeholders.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Secrets:</span>{' '}
                      <span className="text-foreground">
                        {parsedServer.placeholders.length} configured
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                This server will be enabled for all detected apps by default.
                You can customize per-app settings after adding.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={step === 'paste' ? onCancel : handleBack}
          >
            {step === 'paste' ? 'Cancel' : 'Back'}
          </Button>

          <Button
            onClick={handleNext}
            disabled={
              (step === 'paste' && !canProceedToSecrets) ||
              (step === 'secrets' && !canProceedToPreview)
            }
          >
            {step === 'preview' ? 'Add Server' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
