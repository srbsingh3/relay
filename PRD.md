# Relay — macOS MVP Specification (PRD)

## Purpose
Relay is a local-only macOS Electron application that allows users to manage MCP
servers across multiple AI agents such as Cursor, Claude Code, and Codex. It focuses on
simplicity, security, and complete local operation.

## Primary Goals
1. Securely add, remove, toggle, and sync MCP servers.
2. Automatically update Cursor, Claude Code, and Codex MCP config files.
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
  - Cursor: `~/Library/Application Support/Cursor/.../mcp.json`
  - Claude Code: `~/Library/Application Support/Claude/.../mcp.json`
  - Codex: `~/Library/Application Support/Codex/.../mcp.json`

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
4. Sync with Cursor, Claude Code, and Codex configs
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

## Build & Distribution
- macOS only build (`.dmg`)
- App ID: `com.relay.app`
- Product Name: `Relay`
- Category: Developer Tools
- No auto-updater or internet connection

## Completion Criteria
- Works fully offline.
- All tokens stored securely in Keychain.
- Cursor, Claude Code, and Codex configs update correctly.
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

## Agent Detection (MVP)
- Detect presence of Cursor, Claude Code, and Codex agents by checking for their MCP config files.
- Display detected agents in the Settings section.
- Allow toggling of per-app scopes only for detected agents.
- Paths checked: Cursor → `~/Library/Application Support/Cursor/.../mcp.json`; Claude Code → `~/Library/Application Support/Claude/.../mcp.json`; Codex → `~/Library/Application Support/Codex/.../mcp.json`.

### Per-App Toggles (MVP)
- **All apps** master switch on each server row: default ON. Turning it OFF sets all app toggles OFF. Changing any individual toggle switches the master to a **Custom** state; turning the master ON again sets all detected app toggles ON.
- **Servers list:** each server row shows three small pill toggles — Cursor / Claude / Codex — reflecting the per-app scopes in `registry.json` (`apps` object). Default: all ON for detected agents.
- **Add/Edit Modal:** includes an **All apps** switch and the same three toggles. Default is all ON; toggles are disabled (read-only) for agents that are not detected.
