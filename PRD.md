# Relay — macOS MVP Specification (PRD)

## Purpose
Relay is a local-only macOS Electron application that allows users to manage MCP
servers across multiple AI agents such as Cursor, Claude Code, and Codex. It focuses on
simplicity, security, and complete local operation.

## Primary Goals
1. Securely add, remove, toggle, and sync MCP servers.
2. Automatically update Claude Code, Cursor, and Codex MCP configuration files.
3. Store all secrets in the macOS Keychain — no plaintext storage.
4. Operate fully offline — no internet access or telemetry.
5. Provide a minimal, intuitive UI.

## Non-Goals
- No Windows/Linux builds.
- No auto-updates or online sync.
- No analytics or telemetry.
- No process management of MCP servers.

## Architecture Overview
- **Frontend:** React (Vite) inside Electron window.
- **Backend:** Electron main process with Keychain, file IO, and IPC handling.
- **Registry File:** `~/Library/Application Support/Relay/registry.json`
- **Keychain Service:** `com.relay.app` for secret storage.
- **Adapters:**
  - Cursor (user scope): `~/.cursor/mcp.json`
    - Relay writes global MCP entries here (JSON).
    - Project scope (read-only in MVP): `<project>/.cursor/mcp.json` (Relay does not modify project files).

  - Claude Code (user scope): `~/.claude.json`
    - Relay updates the user-level MCP servers inside this file (JSON) and preserves unrelated keys.
    - Project scope (read-only in MVP): `<project>/.mcp.json` (Relay does not modify project files).
    - Note: `~/.claude/settings.json` holds user settings, not the MCP server store.

  - Codex (user scope): `~/.codex/config.toml`
    - Relay updates the TOML MCP section, creating/updating `[mcp_servers.<name>]` tables and preserving other config.

## Data Model

### `registry.json`

```json
{
  "version": 1,
  "servers": [
    {
      "id": "srv_123",
      "name": "Local Search",
      "endpoint": "http://127.0.0.1:3001",
      "tokenAlias": "alias_local_search",
      "enabled": true
    }
  ]
}
```

### Keychain

- Service: `com.relay.app`
- Account: `token:<tokenAlias>`
- Password: secret token value

### Per-app scopes (MVP)
- Each server may include an optional "apps" object to scope enablement per supported agent.
- MVP UI **always** exposes per-app toggles. Default is **All apps ON**; users can then turn specific apps OFF.
- Effective rule: `effectiveEnabled(agent) = enabled && (apps[agent] ?? true)`.
- Storage rule: if all detected apps remain ON, the UI omits the "apps" object (interpreted as all true). It only persists `apps` when an app is explicitly turned OFF.

## Core Features
1. Add MCP Server (Name, Endpoint, Token)
2. Remove MCP Server
3. Toggle MCP Server (enabled/disabled)
4. Sync with Claude Code, Cursor, and Codex configs
5. Detect agents and display config paths
6. Per-app enable/disable scopes (Cursor, Claude Code, Codex) per server

## Security
- `contextIsolation`: true
- `nodeIntegration`: false
- `sandbox`: true
- Strict Content Security Policy (CSP)
- Signed and hardened macOS build
- Tokens only in Keychain, never in registry

## UI Overview
- Dark theme, 900x600 window
- Visual direction follows Apple's macOS Liquid Glass OSS guidelines for a modern, translucent aesthetic across panels and controls.

### Sections
- Servers (Add, Remove, Toggle, Sync)
- Add/Edit Modal (Name, Endpoint, Token)
- Settings (Detected Agents)

### Tray Menu
- Open Relay
- Sync Now
- Quit

### Per-App Toggles (MVP)
- **All apps** master switch on each server row: default ON. Turning it OFF sets all app toggles OFF. Changing any individual toggle switches the master to a **Custom** state; turning the master ON again sets all detected app toggles ON.
- **Servers list:** each server row shows three small pill toggles — Cursor / Claude Code / Codex — with app icons; reflecting per-app scopes in `registry.json` (`apps` object). Default: all ON for detected agents.
- **Add/Edit Modal:** includes an **All apps** switch and the same three toggles (with icons). Toggles are disabled (read-only) for agents that are not detected.

## Build & Distribution
- macOS only build (`.dmg`)
- App ID: `com.relay.app`
- Product Name: `Relay`
- Category: Developer Tools
- No auto-updater or internet connection

## Completion Criteria
- Works fully offline.
- All tokens stored securely in Keychain.
- Claude Code, Cursor, and Codex configurations update correctly.
- Sandbox and hardened runtime enabled.
- Signed macOS build.
- "All apps" master switch behaves as specified: default all ON on add; individual overrides set it to Custom; toggles disabled for undetected agents.

## Future Improvements

- **Drift detection & conflict resolution (post-MVP)**
  - On app launch and when the user clicks **Sync Now**, read each detected agent adapter config (`mcp.json`) for Cursor, Claude Code, and Codex, and diff against the canonical output generated from `registry.json` + Keychain.
  - If drift is detected, present an **Out of sync** prompt with three choices:
    1) **Keep Relay version** — overwrite agent configs with Relay state.
    2) **Import from agent** — update `registry.json` and Keychain from the agent's config.
    3) **Ignore once** — dismiss without changes for this session.
  - Implementation notes: use atomic writes (temp file + fsync + rename), create a `.bak` before overwrite, and display a minimal diff in the UI for clarity.
  - Status: **Not in MVP**; schedule as a post-MVP enhancement.
- **Preview writes (post-MVP)**
  - Add a **Preview writes** toggle to Sync: show per-app tabs (Cursor / Claude Code / Codex) with the exact content that would be written.
  - Present a minimal inline diff against the current on-disk file; support **Copy** and **Save as…**.
  - Allow per-app apply checkboxes; default is all selected.
  - No network calls; respects atomic write + `.bak` safeguards.

## Agent Detection (MVP)
- Cursor: mark **Detected** if `~/.cursor/mcp.json` exists OR the `~/.cursor` directory exists.
- Claude Code: mark **Detected** if `~/.claude.json` exists OR the `claude` CLI is on PATH (`which claude`).
- Codex: mark **Detected** if `~/.codex/config.toml` exists OR the `codex` CLI is on PATH (`which codex`).
- Show the resolved user config path(s) in Settings (read-only).
- No deep scanning and no background watching.

## Sync Behavior
- Cursor: write the effective MCP servers to `~/.cursor/mcp.json` (JSON merge; atomic write: temp file + fsync + rename; also create a `.bak`).
- Claude Code: merge enabled servers into `~/.claude.json` under the MCP section; remove disabled; atomic write with `.bak`.
- Codex: update `~/.codex/config.toml` by creating/updating `[mcp_servers.<name>]` tables; remove disabled; atomic write with `.bak`.

## Happy Path Task Flow (MVP)

1. **Launch Relay** — Detected apps are shown; per-app toggles default **ON** (All apps ON).
2. **Add MCP Server** — Click **Add Server** and fill:
   - **Name** (e.g., "Context7").
   - **Launch (STDIO command)**: `command` and optional `args[]`.
   - **Env vars (optional)**: add keys; values stored in **Keychain** via alias; never written to disk in plaintext.
   - **Scope**: keep **All apps** ON with app chips for **Cursor / Claude Code / Codex**.
3. **Save** — Server is written to `registry.json`; secrets to Keychain.

   **Example canonical entry (generated in `registry.json`):**
   ```json
   {
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
4. **Sync Now** — Relay writes the correct format per app:
   - **Cursor** → update `~/.cursor/mcp.json` (JSON merge under `mcpServers`).
     ```json
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
   - **Claude Code** → merge into `~/.claude.json` under `mcpServers`.
     ```json
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
   - **Codex** → update `~/.codex/config.toml` under `[mcp_servers."<name>"]`.
     ```toml
     [mcp_servers."Context7"]
     command = "context7-mcp"
     args = []
     env = { CONTEXT7_API_KEY = "<resolved-from-keychain>" }
     ```
5. **Confirmation** — Show toast: `Synced (3 apps)` (or `Synced (N apps)` if some were not detected).
6. **Use** — Open the apps; restart if required for them to pick up changes.

## Edge Cases (MVP)

- **App not detected** — Toggle is disabled; Sync skips that app and shows `Synced (N/3 apps)`.
- **Missing files/directories** — Create parent dirs and initialize minimal config files if absent.
- **Invalid existing config (JSON/TOML)** — Before writing, create a `.bak`. If parse fails, surface an error with actions: **Open file**, **Restore backup**, **Skip this app**.
- **Permission denied / read-only filesystem** — Abort for that app with a clear error; do not escalate privileges.
- **Command not found** — We still write configs; show a non-blocking warning that the app may fail to launch the server until it’s installed.
- **Secrets not provided** — If an env var value isn’t in Keychain, show a warning on Save and exclude that key from the written config; user can add it later and re-sync.
- **Concurrent edits during Sync** — Writes are atomic; last-write-wins (drift detection is post-MVP).
- **Non-standard install paths** — We only write to default user-scope paths. Project-scoped files are read-only in MVP.
- **Path resolution** — Expand `~` via OS APIs and follow symlinks to avoid partial paths.
- **App open while writing** — Atomic rename avoids partial reads; apps typically load config on start—restart if needed.

## Config Examples (for AI Coding Agents)

### Canonical object (registry.json)
```json
{
  "id": "srv_context7",
  "name": "Context7",
  "enabled": true,
  "launch": { "mode": "command", "command": "context7-mcp", "args": [] },
  "env": { "CONTEXT7_API_KEY": "keychain:alias_context7_api_key" },
  "apps": { "cursor": true, "claude": true, "codex": true }
}
```

### Adapter outputs
**Cursor → `~/.cursor/mcp.json`**
```json
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

**Claude Code → `~/.claude.json`**
```json
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

**Codex → `~/.codex/config.toml`**
```toml
[mcp_servers."Context7"]
command = "context7-mcp"
args = []
env = { CONTEXT7_API_KEY = "<resolved-from-keychain>" }
```

### Atomic write helper (TypeScript)
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
    await fs.writeFile(tmp, content, { encoding: "utf8" });
    await fs.rename(tmp, filePath);
  } finally {
    try { await fs.unlink(tmp); } catch {}
  }
}
```

### Keychain resolution
- Store secrets as `keychain:<alias>` in `registry.json`.
- At sync time, resolve each alias to a plaintext value **in memory** and inject into the per-app config objects.
- Never persist resolved secret values in `registry.json`.
