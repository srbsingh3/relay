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

## Core Features
1. Add MCP Server (Name, Endpoint, Token)
2. Remove MCP Server
3. Toggle MCP Server (enabled/disabled)
4. Sync with Cursor, Claude Code, and Codex configs
5. Detect agents and display config paths

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
