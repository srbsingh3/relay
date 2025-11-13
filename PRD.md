# Relay — AI Build PRD (macOS MVP)

## Mission Snapshot
- macOS-only Electron app that locally manages MCP servers shared by Cursor, Claude Code, and Codex.
- Privacy-first networking: no telemetry, no data collection, and no remote sync. Relay performs only minimal, transparent, periodic update checks.
- Prioritizes secure secret storage (macOS Keychain) and deterministic config writes for each supported agent.

## Success Criteria
- Users can add, remove, edit, enable/disable MCP servers.
- Per-app scopes for Cursor/Claude Code/Codex are always available and default to ON.
- `Sync Now` updates each detected agent's config file exactly once per invocation, preserving unrelated keys and creating `.bak` backups.
- Tokens never touch disk outside Keychain; Keychain lookups happen only in-memory during sync.
- Binary ships as signed, hardened macOS `.dmg` with sandbox, `contextIsolation`, and `nodeIntegration=false`.

## Scope Guardrails (Non-goals)
- No Windows/Linux builds, no telemetry or analytics. Auto-update installation is out of scope for MVP (but update checking is allowed).
- No process management for MCP servers themselves.
- Project-scoped agent configs are read-only for MVP.
- Drift detection, diff previews, or cloud sync are explicitly post-MVP.

## System Blueprint
- **Frontend:** React + Vite + Tailwind CSS with shadcn/ui components rendered inside Electron BrowserWindow (900×600, dark theme).
- **Backend:** Electron main process handles IPC, filesystem IO, Keychain calls, and tray menu.
- **Registry:** `~/Library/Application Support/Relay/registry.json` (canonical server list + metadata).
- **Keychain:** macOS Keychain item service `com.relay.app`; account format `token:<alias>`.
- **Secrets contract:** `registry.json` stores only aliases (`keychain:<alias>`). Plaintext secrets live solely in Keychain.
- **Tray menu:** Open Relay, Sync Now, Quit.

## Data Contracts
### Registry schema (versioned JSON)
```json
{
  "version": 1,
  "servers": [
    {
      "id": "srv_context7",
      "name": "Context7",
      "enabled": true,
      "launch": { "mode": "command", "command": "context7-mcp", "args": [] },
      "env": { "CONTEXT7_API_KEY": "keychain:alias_context7_api_key" },
      "apps": { "cursor": true, "claude": true, "codex": true }
    }
  ]
}
```
- `apps` is optional; omit it when every detected app is ON. Persist only the overrides (false entries) to keep defaults implicit.
- Effective enablement formula: `effectiveEnabled(agent) = enabled && (apps[agent] ?? true)`.

### Keychain usage
- `service = "com.relay.app"`, `account = "token:<alias>"`, `password = <secret>`.
- Write/update secrets when the user saves a server. Delete on server removal if no other server reuses the alias.

## Adapter Contracts (user scope paths)
| Agent | Path | Format | Write Rules |
| --- | --- | --- | --- |
| Cursor | `~/.cursor/mcp.json` | JSON with `mcpServers` map | Merge Relay servers into `mcpServers`. Remove entries Relay manages when disabled. Preserve unrelated keys. |
| Claude Code | `~/.claude.json` | JSON with `mcpServers` | Same merge/remove behavior; leave other top-level keys untouched. |
| Codex | `~/.codex/config.toml` | TOML with `[mcp_servers."<name>"]` tables | Create/update/delete tables per Relay server. Preserve all other config blocks. |

- Project-scope files (`<project>/.cursor/mcp.json`, `<project>/.mcp.json`) are displayed read-only; Relay never edits them in MVP.
- Path resolution must expand `~`, follow symlinks, and ensure parent directories exist before writing.

## Agent Detection Logic
- Cursor detected if `~/.cursor` directory exists or `~/.cursor/mcp.json` file exists.
- Claude Code detected if `~/.claude.json` exists or `which claude` succeeds.
- Codex detected if `~/.codex/config.toml` exists or `which codex` succeeds.
- Surface detection status + resolved config paths inside Settings; non-detected app toggles are disabled.

## UX & Behavior
- **Servers list:** rows show name, endpoint summary, enable toggle, All Apps master switch, and per-app pill toggles (Cursor / Claude / Codex). Icons optional but recommended.
- **All Apps switch:** ON sets every detected app to true. Turning OFF sets all to false. Changing any individual toggle sets master to `Custom`. Toggling master back ON sets all detected apps to true again.
- **Add/Edit modal:** fields for Name, Endpoint/Launch command + args, token alias (with Keychain write), optional env vars, enable toggle, and per-app toggles (disabled for undetected apps). Validation happens inline.
- **Settings view:** shows detected agents, their config paths, last sync timestamp, and a `Sync Now` button.
- **Notifications:** toast `Synced (N apps)`; include partial counts when some apps are skipped.

## Primary User Flows
1. **Launch**: initialize registry if missing, detect agents, load Keychain aliases.
2. **Add server**:
   - Collect Name, command, optional args/env vars, Keychain alias + value.
   - Default `enabled=true`, All Apps ON.
   - Persist server to registry (assign `id`, ensure uniqueness) and secrets to Keychain.
3. **Edit server**: same modal; allow renaming and alias reassignment. Keep historical `.bak` of registry prior to save.
4. **Toggle enablement / per-app scopes**: update registry immediately; no Keychain touch unless alias changed.
5. **Remove server**: delete from registry, optionally delete Keychain secret (only if no other server references alias).
6. **Sync Now**:
   - Resolve secrets from Keychain for each enabled server and each app with `effectiveEnabled=true`.
   - Materialize adapter-specific payloads (JSON/TOML) and run atomic writes (details below).
   - Skip undetected apps; include them in the confirmation count as `Synced (N/3 apps)`.

## Sync & File IO Rules
- Always perform atomic writes: write to `*.tmp`, `fsync`, rename, clean up.
- Before overwrite, copy current file to `*.bak`. If the destination is missing, create directories and start from minimal scaffold.
- Invalid JSON/TOML → surface error with actions: Open file, Restore backup, Skip app. Never leave partial files behind.

```ts
import { promises as fs } from "fs";
import { dirname } from "path";

async function ensureDir(path: string) {
  await fs.mkdir(path, { recursive: true });
}

export async function atomicWrite(filePath: string, content: string) {
  const dir = dirname(filePath);
  await ensureDir(dir);
  const tmp = `${filePath}.tmp`;
  const bak = `${filePath}.bak`;

  try {
    try { await fs.copyFile(filePath, bak); } catch {}
    await fs.writeFile(tmp, content, "utf8");
    await fs.rename(tmp, filePath);
  } finally {
    try { await fs.unlink(tmp); } catch {}
  }
}
```

### Adapter Output References
```jsonc
// Cursor ~/.cursor/mcp.json
{
  "mcpServers": {
    "Context7": {
      "command": "context7-mcp",
      "args": [],
      "env": { "CONTEXT7_API_KEY": "<resolved-from-keychain>" }
    }
  }
}
```
```jsonc
// Claude Code ~/.claude.json
{
  "mcpServers": {
    "Context7": {
      "command": "context7-mcp",
      "args": [],
      "env": { "CONTEXT7_API_KEY": "<resolved-from-keychain>" }
    }
  }
}
```
```toml
# Codex ~/.codex/config.toml
[mcp_servers."Context7"]
command = "context7-mcp"
args = []
env = { CONTEXT7_API_KEY = "<resolved-from-keychain>" }
```

## Security Hard Requirements
- Electron `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true`.
- Strict Content Security Policy; load assets from local files only.
- Keep secrets in-process only; purge buffers immediately after sync.
- Sign + harden the macOS build. All network usage limited strictly to update checks; no other network permissions used.

## Edge Cases & Error Handling
- **Missing paths**: create parent directories and seed minimal config structures.
- **Invalid config syntax**: stop writing, leave `.bak`, show actionable error with Open / Restore / Skip.
- **Permission denied**: abort for that app, show error, continue with others.
- **Command not installed**: still write configs; surface warning that the MCP binary may be missing.
- **Secret missing in Keychain**: warn user, omit the env var from generated config, keep server saved so they can fix and re-sync.
- **Concurrent edits**: rely on atomic overwrite; last write wins (drift detection is future work).
- **App running during sync**: atomic rename prevents partial reads; tell users to restart target apps if needed.

## Build & Distribution
- Target macOS `.dmg`; App ID `com.relay.app`, Product Name `Relay`, Category `Developer Tools`.
- No auto-updater for MVP; Relay may perform minimal update checks and notify the user when a new version is available.

## Network Policy
- Relay operates with a privacy-first networking model.
- No telemetry, analytics, usage reporting, or remote sync is ever performed.
- Relay conducts a minimal, read-only network request to check for application updates (e.g., a small JSON manifest).
- Update checks contain no user data, no secrets, and no MCP information.
- Users may disable update checks in Settings (optional for MVP).

## Recommended Implementation Order (for AI agent)
1. Scaffold Electron + Vite project with secure BrowserWindow defaults and tray menu.
2. Implement registry + Keychain services (read/write, schema validation, migrations).
3. Build server CRUD UI (list + modal) including All Apps logic.
4. Add agent detection + Settings view.
5. Implement sync engine adapters (Cursor → Claude → Codex) reusing shared atomic write helper.
6. Wire `Sync Now` from UI + tray; include toast feedback and error surfaces per app.
7. Add packaging configuration for signed, hardened `.dmg` (macOS only) and ensure offline mode.
8. QA edge cases: missing files, invalid JSON/TOML, missing secrets, disabled apps.

## Post-MVP Backlog
- Drift detection with diff + resolve actions.
- Sync preview showing generated content per app before write.
- Per-project config management.
- Optional telemetry/health checks (only if requirements change to allow network).
- Opt-in local usage metrics (append-only log + lightweight dashboard) so the author can track adoption without leaving the offline sandbox.
