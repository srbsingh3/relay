# Relay — AI Build PRD (macOS MVP)

## Mission Snapshot
- macOS-only Electron app that locally manages MCP servers shared by Cursor, Claude Code, and Codex.
- **Paste-to-add simplicity**: Users paste MCP config JSON from documentation and Relay handles the rest—detecting server type, prompting for API keys, and syncing to all apps.
- Privacy-first networking: no telemetry, no data collection, and no remote sync. Relay performs only minimal, transparent, periodic update checks.
- Prioritizes secure secret storage (macOS Keychain) and deterministic config writes for each supported agent.

## Success Criteria
- Users can paste MCP server configs (URL-based or command-based) directly from provider documentation.
- Relay auto-detects placeholder values (e.g., `YOUR_API_KEY`) and prompts for real secrets, storing them in Keychain.
- Per-app scopes for Cursor/Claude Code/Codex are always available and default to ON.
- `Sync Now` updates each detected agent's config file exactly once per invocation, preserving unrelated keys and creating `.bak` backups.
- Tokens never touch disk outside Keychain; Keychain lookups happen only in-memory during sync.
- Modern, developer-focused UI with Dark/Light/System theme support.
- Binary ships as signed, hardened macOS `.dmg` with sandbox, `contextIsolation`, and `nodeIntegration=false`.

## Scope Guardrails (Non-goals)
- No Windows/Linux builds, no telemetry or analytics. Auto-update installation is out of scope for MVP (but update checking is allowed).
- No process management for MCP servers themselves.
- No manual server configuration form (paste-only flow for simplicity).
- Project-scoped agent configs are read-only for MVP.
- Drift detection, diff previews, or cloud sync are explicitly post-MVP.

## System Blueprint
- **Frontend:** React + Vite + Tailwind CSS with shadcn/ui components rendered inside Electron BrowserWindow (1100×700).
- **Theme:** Dark/Light/System toggle with CSS custom properties. Default: System preference. Linear/Cursor-inspired developer aesthetic.
- **Backend:** Electron main process handles IPC, filesystem IO, Keychain calls, and tray menu.
- **Registry:** `~/Library/Application Support/Relay/registry.json` (canonical server list + metadata).
- **Keychain:** macOS Keychain item service `com.relay.app`; account format `token:<alias>`.
- **Secrets contract:** `registry.json` stores only aliases (`keychain:<alias>`). Plaintext secrets live solely in Keychain.
- **Config Parser:** Parses pasted MCP JSON, detects server type (URL vs command), extracts placeholders, and prompts for secrets.
- **Tray menu:** Open Relay, Sync Now, Quit.

## Data Contracts
### Registry schema (versioned JSON)
```json
{
  "version": 2,
  "servers": [
    {
      "id": "srv_context7",
      "name": "Context7",
      "enabled": true,
      "type": "command",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": { "CONTEXT7_API_KEY": "keychain:context7_api_key" },
      "apps": { "cursor": true, "claude": true, "codex": true }
    },
    {
      "id": "srv_context7_url",
      "name": "Context7 (URL)",
      "enabled": true,
      "type": "url",
      "url": "https://mcp.context7.com/mcp",
      "headers": { "CONTEXT7_API_KEY": "keychain:context7_api_key" },
      "apps": { "cursor": true, "claude": true, "codex": true }
    }
  ]
}
```
- **Server types**: `"command"` for local process servers (npx, binary), `"url"` for HTTP-based MCP servers.
- **Command servers**: `command` + `args` + optional `env` (secrets via `keychain:<alias>`).
- **URL servers**: `url` + optional `headers` (secrets via `keychain:<alias>`).
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

## UI Design
### Design Language
- **Aesthetic:** Modern developer tool (Linear/Cursor-inspired). Clean, minimal, focused.
- **Theme:** Dark/Light/System toggle. Dark mode default for developer appeal.
- **Motion:** Sparingly and intentionally—subtle transitions for state changes, no gratuitous animations.
- **Typography:** System fonts, clear hierarchy, monospace for code/commands.

### Servers List (Main View)
- **Card-based layout:** Each server as a card with prominent master toggle.
- **Master switch:** Large, prominent toggle controlling server across all apps. This is the primary interaction.
- **Server info:** Name, type badge (URL/Command), command or endpoint preview.
- **Per-app toggles:** Secondary row of smaller toggles (Cursor / Claude / Codex) for granular control.
- **Disabled states:** Per-app toggles disabled for undetected apps, with visual indication.
- **Actions:** Edit (opens details), Delete (with confirmation).

### Add Server Flow (Paste-to-Add)
- **Primary input:** Large textarea for pasting MCP config JSON.
- **Supported formats:**
  ```json
  // URL-based server
  {
    "mcpServers": {
      "server-name": {
        "url": "https://example.com/mcp",
        "headers": { "API_KEY": "YOUR_API_KEY" }
      }
    }
  }

  // Command-based server
  {
    "mcpServers": {
      "server-name": {
        "command": "npx",
        "args": ["-y", "@package/mcp", "--api-key", "YOUR_API_KEY"]
      }
    }
  }
  ```
- **Parsing:** On paste, Relay parses JSON, extracts server name, type, and config.
- **Placeholder detection:** Scans for patterns like `YOUR_API_KEY`, `YOUR_TOKEN`, `<api-key>`, `REPLACE_ME`, etc.
- **Secret prompts:** For each detected placeholder, show labeled input field requesting real value.
- **Preview:** Show parsed server summary before saving.
- **Save:** Store config in registry, secrets in Keychain, default all apps ON.

### Edit Server View
- **Read-only summary:** Server name, type, endpoint/command.
- **Editable secrets:** Option to update API keys (re-prompts for new value).
- **Per-app toggles:** Full control over which apps receive this server.
- **Delete:** Remove server with confirmation.

### Settings View
- **Theme selector:** Dark / Light / System toggle.
- **Detected agents:** Cards showing status + config paths for Cursor, Claude Code, Codex.
- **Sync status:** Last sync timestamp, `Sync Now` button.
- **Update check:** Version info, manual check button, opt-out toggle.

### Notifications
- **Toast messages:** `Synced (N apps)` on success; partial counts when some apps skipped.
- **Error handling:** Clear error messages with actionable options (Open file / Restore backup / Skip).

## Primary User Flows
1. **Launch**: Initialize registry if missing, detect agents, load Keychain aliases, apply saved theme preference.
2. **Add server** (paste-to-add):
   - User pastes MCP config JSON from provider documentation.
   - Relay parses JSON, extracts server name and config (command or URL type).
   - Relay scans for placeholder patterns (`YOUR_API_KEY`, `YOUR_TOKEN`, `<api-key>`, etc.).
   - For each placeholder found, prompt user for actual secret value.
   - Show preview of parsed server (name, type, endpoint/command).
   - On confirm: generate unique `id`, default `enabled=true`, All Apps ON, persist to registry, store secrets in Keychain.
3. **Edit server**: View server details, update secrets, toggle per-app scopes. Keep `.bak` of registry prior to save.
4. **Toggle enablement / per-app scopes**: Update registry immediately; no Keychain touch unless alias changed.
5. **Remove server**: Delete from registry, delete Keychain secrets only when alias unused elsewhere. Confirm destructive action.
6. **Sync Now**:
   - Resolve secrets from Keychain for each enabled server and each app with `effectiveEnabled=true`.
   - Materialize adapter-specific payloads (JSON for Cursor/Claude, TOML for Codex) and run atomic writes.
   - Handle both command-based and URL-based server formats per adapter requirements.
   - Skip undetected apps; include them in the confirmation count as `Synced (N/3 apps)`.
7. **Change theme**: Toggle between Dark/Light/System; persist preference and apply immediately.

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

#### Command-based servers
```jsonc
// Cursor ~/.cursor/mcp.json
{
  "mcpServers": {
    "Context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
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
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": { "CONTEXT7_API_KEY": "<resolved-from-keychain>" }
    }
  }
}
```
```toml
# Codex ~/.codex/config.toml
[mcp_servers."Context7"]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
env = { CONTEXT7_API_KEY = "<resolved-from-keychain>" }
```

#### URL-based servers
```jsonc
// Cursor ~/.cursor/mcp.json
{
  "mcpServers": {
    "Context7": {
      "url": "https://mcp.context7.com/mcp",
      "headers": { "CONTEXT7_API_KEY": "<resolved-from-keychain>" }
    }
  }
}
```
```jsonc
// Claude Code ~/.claude.json
{
  "mcpServers": {
    "Context7": {
      "url": "https://mcp.context7.com/mcp",
      "headers": { "CONTEXT7_API_KEY": "<resolved-from-keychain>" }
    }
  }
}
```
```toml
# Codex ~/.codex/config.toml
[mcp_servers."Context7"]
url = "https://mcp.context7.com/mcp"
headers = { CONTEXT7_API_KEY = "<resolved-from-keychain>" }
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
2. Implement theme system (Dark/Light/System) with CSS custom properties and persistence.
3. Implement registry + Keychain services (read/write, schema validation, migrations for v2 schema).
4. Build config parser service for paste-to-add flow (JSON parsing, placeholder detection, secret prompts).
5. Build modern UI: server list with master toggles, paste-to-add flow, settings view.
6. Add agent detection + integrate with per-app toggles.
7. Implement sync engine adapters (Cursor → Claude → Codex) supporting both URL and command server types.
8. Wire `Sync Now` from UI + tray; include toast feedback and error surfaces per app.
9. Add packaging configuration for signed, hardened `.dmg` (macOS only) and ensure offline mode.
10. QA edge cases: missing files, invalid JSON/TOML, missing secrets, disabled apps, both server types.

## Post-MVP Backlog
- Drift detection with diff + resolve actions.
- Sync preview showing generated content per app before write.
- Per-project config management.
- Import from existing config files (scan and import servers from Cursor/Claude/Codex configs).
- Server templates/presets for popular MCP providers.
- Optional telemetry/health checks (only if requirements change to allow network).
- Opt-in local usage metrics (append-only log + lightweight dashboard) so the author can track adoption without leaving the offline sandbox.
