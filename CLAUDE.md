# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Relay is a **macOS-only Electron application** that serves as an offline-first MCP (Model Context Protocol) orchestrator. It manages shared MCP servers across Cursor, Claude Code, and Codex with a strong focus on privacy and security.

**North Stars:**
- macOS-only Electron app (React/Vite renderer) that manages shared MCP servers for Cursor, Claude Code, and Codex with an offline-first UX; the only permitted network activity is a transparent, read-only update check.
- Secrets live only in Keychain (`service=com.relay.app`, `account=token:<alias>`); registry stores aliases.
- Every sync is deterministic: atomic writes, `.bak` backups, per-app merge logic, and no telemetry.
- Distribution target: signed & hardened `.dmg` with `sandbox=true`, `contextIsolation=true`, `nodeIntegration=false`, strict CSP, and local assets only, with networking locked down to the update manifest endpoint.

## Architecture

### Monorepo Structure
- **Root**: Workspace configuration with `packages/*` pattern
- **`packages/main/`**: Electron main process (Node.js/CommonJS)
- **`packages/renderer/`**: React frontend (Vite/ESM)

### Technology Stack
- **Frontend**: React 19.2.0 + Vite + Tailwind CSS v4 + shadcn/ui components
- **Backend**: Electron 39.1.2 + TypeScript
- **Security**: Keytar for macOS Keychain integration
- **Testing**: Vitest with jsdom environment
- **Build**: TypeScript compilation + Vite bundling

## Development Commands

```bash
# Development (start all services)
npm run dev

# Individual development services
npm run dev:main              # Watch TypeScript compilation for main process
npm run dev:renderer          # Watch Vite build for renderer
npm run dev:electron          # Start Electron when bundles are ready

# Building
npm run build                 # Build both main and renderer
npm run build:main            # Compile main process TypeScript
npm run build:renderer        # Build renderer with Vite

# Quality assurance
npm run lint                  # ESLint all packages
npm run test                  # Run Vitest tests
npm run typecheck             # TypeScript type checking
```

## Core Architecture Patterns

### Main Process Services (`packages/main/src/`)
- **IPC Handlers**: Secure communication bridge between main and renderer
- **Registry Service**: Versioned JSON registry for server configurations
- **Keychain Service**: macOS Keychain integration for secure secret storage
- **Detection Service**: Agent detection (Cursor/Claude/Codex)
- **Sync Service**: Config file synchronization with atomic writes
- **Update Service**: Minimal update checking (privacy-first)

### Renderer Architecture (`packages/renderer/src/`)
- **Component-based**: React with functional components and hooks
- **UI Library**: shadcn/ui components (Button, Card, Badge, Input, Textarea)
- **Styling**: Tailwind CSS v4 with CSS custom properties for theming
- **State Management**: React useState/useContext patterns

## Operating Principles (Critical)

1. **Security before speed** – honor the Keychain contract, purge in-memory secrets after use, never expose Node globals to the renderer, and block any feature that could leak credentials.
2. **Deterministic IO** – touch configs only after detection passes, use the shared `atomicWrite` helper with tmp/bak flow, and preserve unrelated keys per adapter rules.
3. **Privacy-first networking** – ship all assets locally, disable analytics, limit networking to a single manifest fetch for update checks, respect an opt-out toggle, and verify the app still works with the network disabled.
4. **Scope discipline** – macOS only, no process management, per-project writes, drift detection, or cloud sync until post-MVP.
5. **One pipeline** – UI actions, tray menu, and scheduled syncs all route through the same main-process services for registry, Keychain, detection, and adapters.
6. **Transparent update checks** – run the manifest fetch in the main process, never send secrets or MPC data, reuse one service for scheduled + manual checks, and surface results without auto-installing anything.

### Security Requirements

### Electron Security
- `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true`
- Content Security Policy: Strict CSP with local assets only
- No remote code execution or asset loading

### Keychain Integration
- **Service**: `com.relay.app`
- **Account format**: `token:<alias>`
- **Secrets contract**: Registry stores only aliases (`keychain:<alias>`), plaintext secrets live only in Keychain
- **Reference counting**: Delete secrets only when no server references remain

### File Operations
- **Atomic writes**: Always use `atomicWrite` helper with `.tmp` and `.bak` files
- **Deterministic IO**: Use shared `ensureDir` and `atomicWrite` helpers
- **No telemetry**: All networking limited to update checks only

## Data Contracts

### Registry Schema (`~/Library/Application Support/Relay/registry.json`)
```json
{
  "version": 1,
  "servers": [
    {
      "id": "unique_id",
      "name": "Server Name",
      "enabled": true,
      "launch": {
        "mode": "command",
        "command": "command-name",
        "args": []
      },
      "env": { "API_KEY": "keychain:alias" },
      "apps": { "cursor": true, "claude": true, "codex": true }
    }
  ]
}
```

### Agent Config Paths
- **Cursor**: `~/.cursor/mcp.json` (JSON format)
- **Claude Code**: `~/.claude.json` (JSON format)
- **Codex**: `~/.codex/config.toml` (TOML format)

## Development Patterns

### State Management
- Use React hooks for local component state
- IPC bridge for main process communication
- Fallback data for development without bridge

### Styling Guidelines
- **Primary**: Tailwind CSS v4 utilities + shadcn/ui primitives
- **Theme**: Dark-first with light/system support via CSS custom properties
- **Design System**: Treat renderer as shadcn-admin style surface (dark-first with polished light/system toggle)
- **Icons**: Use Lucide React icons only when necessary; avoid decorative or non-essential icon usage
- **Avoid**: Custom CSS unless absolutely necessary

### Component Patterns
- Functional components with TypeScript interfaces
- shadcn/ui components for consistent UI
- Proper ARIA labels and accessibility
- Responsive design with mobile-first approach

## Key Development Constraints

### Platform Scope
- **macOS only**: Deliberate platform focus for MVP
- **Offline-first**: All functionality works without network connectivity
- **No Windows/Linux builds**, no telemetry or analytics

### Feature Boundaries (MVP)
- No process management for MCP servers themselves
- Project-scoped agent configs are read-only
- No drift detection, diff previews, or cloud sync

## File IO Patterns

### Atomic Write Implementation
Always use the shared `atomicWrite` helper:
```typescript
await atomicWrite(filePath, content)
// Creates .tmp file, fsync, renames, manages .bak backups
```

### Error Handling
- Preserve `.bak` files for restore scenarios
- Surface actionable errors with Open/Restore/Skip options
- Handle missing files, invalid JSON/TOML, permission errors

## Testing Strategy

### Unit Tests
- Registry service operations
- Keychain service with reference counting
- Atomic write helper edge cases
- Adapter logic for each agent format

### Integration Tests
- Full sync workflows with mocked filesystem
- Detection service scenarios
- Error recovery paths

## Build & Distribution

### Target Configuration
- **Platform**: macOS `.dmg` only
- **App ID**: `com.relay.app`
- **Category**: `Developer Tools`
- **Security**: Signed and hardened build

### Privacy Guarantees
- No auto-updater for MVP (update checks only)
- No telemetry, analytics, or usage reporting
- Network requests limited to update manifest only

## Project References

### Documentation Hierarchy
- **`PRD.md`**: Product truth (what + why) - treat as authoritative source
- **`AGENTS.md`**: Guardrails + collaboration rules (how to make decisions) - this file you're reading
- **`TASKS.md`**: Step-by-step work orders and current progress

### Implementation Status
Based on recent commits, the project has completed:
- Foundation & shell (Electron + Vite setup)
- Registry & Keychain services
- Servers UI (CRUD operations)
- Detection & Settings views
- Partial sync engine implementation

Current branch: `ux-refactor-without-liquid-glass` (UI migration to shadcn/ui)

## Working Guidelines

### Working Rhythm & Hygiene
- **Always start in `TASKS.md`** – confirm priority, current milestone, and remaining checkboxes before touching code. Update the checklist as tasks close; let TASKS capture the granular status.
- **TodoWrite / personal tracking** – use the TodoWrite tool to break large checklist items into concrete subtasks while you implement them.
- **Honor existing patterns** – read the surrounding files, mirror established conventions, and prefer evolving shared helpers over one-off fixes.
- **Incremental testing** – run relevant unit/integration tests after each meaningful change; never stack unverified edits.
- **Conventional commits** – when committing, use `type(scope): summary` formatting so history stays machine-readable.
- **Design-facing communication** – Remember the UI owner is not deeply technical. When describing changes, keep explanations simple, intuitive, and focused on how the change affects the user experience. Avoid jargon unless necessary, and add a brief plain‑language summary so the reasoning is easy to follow.

### Before Making Changes
1. Re-read the relevant section of `TASKS.md`.
2. Inspect the existing implementation in that area; note established patterns.
3. Validate your approach against similar modules to avoid one-off logic.
4. Double-check the change won't regress current functionality before writing new code.

### Working With Design
- Share data contracts (server row fields, modal states, detection cards, toast copy) before implementation so Tailwind utility classes and shadcn/ui primitives can be applied once and reused across screens.
- Prefer Tailwind + shadcn/ui over ad-hoc CSS; if a layout or interaction can't be expressed cleanly with the existing primitives, sync with design before introducing custom styling or one-off components.
- Confirm All Apps vs Custom logic and disabled toggle behavior in design reviews before merging UI changes.
- Align on update-check card copy (status text, last-checked timestamp, disable toggle, CTA) so the UX stays transparent and privacy expectations are clear.
- Surface blockers early: missing assets, copy, or interaction changes should be resolved with design before code freeze on each milestone.

### Code Quality
- Follow existing TypeScript patterns and interfaces
- Use established shadcn/ui component patterns
- Maintain atomic write and Keychain security contracts
- Test edge cases, especially error handling paths

### Git Workflow
- Use conventional commit format: `type(scope): summary`
- Reference relevant task numbers when applicable
- Ensure all tests pass before committing changes

## Definition of Done
- All PRD success criteria met: CRUD works, per-app scopes default ON, deterministic sync with `.bak`, and Keychain is the only secret store.
- Detection reflects real filesystem/binary presence; undetected apps stay disabled and excluded from sync counts.
- `Sync Now` produces correct JSON/TOML for each detected agent with atomic writes and restore prompts for invalid files.
- `.dmg` build launches offline, tray menu works (Open/Sync Now/Quit), and QA checklist plus release notes are complete.
- Update-check service performs a minimal, read-only manifest fetch, surfaces status/notifications in Settings, and honors the user's opt-out.