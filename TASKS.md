# Relay — TASKS (macOS MVP)

This checklist mirrors the build phases in `AGENTS.md` and the contracts in `PRD.md`.
Use it as the primary execution plan for the macOS MVP.

## How to Use This Checklist
1. Start each milestone by rereading the “Milestone Handshake” section in `AGENTS.md` so the intent is fresh.
2. Work through the checkboxes below; add sub-tasks in your tooling if a step needs deeper tracking.
3. Keep `PRD.md` open for data contracts/guardrails when making design or implementation decisions.

---

## Milestone 1 — Foundation & Shell

- [x] 1.1 **Scaffold project**
  - [x] 1.1.1 Create Electron + Vite monorepo / packages structure.
  - [x] 1.1.2 Set up shared TypeScript config, linting, and testing baseline.
  - [x] 1.1.3 Add `PRD.md`, `AGENTS.md`, and `TASKS.md` to the repo as living references.

- [x] 1.2 **Secure BrowserWindow shell**
  - [x] 1.2.1 Create main Electron process entry.
  - [x] 1.2.2 Configure a single BrowserWindow:
    - [x] 1.2.2.1 Size: 900×600.
    - [x] 1.2.2.2 Dark theme and base Liquid Glass aesthetic (can be basic initially).
  - [x] 1.2.3 Enforce Electron security flags:
    - [x] 1.2.3.1 `contextIsolation = true`
    - [x] 1.2.3.2 `nodeIntegration = false`
    - [x] 1.2.3.3 `sandbox = true`
  - [x] 1.2.4 Load UI via local `index.html` only (no remote URLs).

- [x] 1.3 **Content Security Policy / offline guardrails**
  - [x] 1.3.1 Add CSP: `default-src 'self'`.
  - [x] 1.3.2 Ensure no fonts/scripts/styles are loaded from remote CDNs.
  - [x] 1.3.3 Audit dependencies for telemetry/analytics and disable/remove them.
  - [x] 1.3.4 Confirm app functions with network disabled (no network calls made on launch).

- [x] 1.4 **Preload + IPC contract**
  - [x] 1.4.1 Implement preload script exposing a minimal, typed IPC bridge.
  - [x] 1.4.2 Define IPC channels for:
    - [x] 1.4.2.1 Registry read/write.
    - [x] 1.4.2.2 Keychain lookups.
    - [x] 1.4.2.3 Agent detection results.
    - [x] 1.4.2.4 Sync invocation + status.
  - [x] 1.4.3 Ensure preload never exposes Node primitives directly to the renderer.

- [x] 1.5 **Tray menu**
  - [x] 1.5.1 Add tray icon and menu with:
    - [x] 1.5.1.1 “Open Relay”
    - [x] 1.5.1.2 “Sync Now”
    - [x] 1.5.1.3 “Quit”
  - [x] 1.5.2 Wire “Open Relay” to show/focus BrowserWindow.
  - [x] 1.5.3 Wire “Sync Now” to the same sync flow used by Settings.
  - [x] 1.5.4 Ensure tray menu works correctly when app is hidden and on cold start.

- [x] 1.6 **Milestone exit gate**
  - [x] 1.6.1 BrowserWindow uses `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true`, and only loads local assets.
  - [x] 1.6.2 Tray menu (Open/Sync Now/Quit) works after a cold start with the network disabled.

---

## Milestone 2 — Registry & Keychain Services

- [x] 2.1 **Registry schema + file**
  - [x] 2.1.1 Define TypeScript types mirroring `PRD.md` registry sample:
    - [x] 2.1.1.1 `version`, `servers[]`, `launch`, `env`, `apps`, etc.
  - [x] 2.1.2 Implement registry location:
    - [x] 2.1.2.1 `~/Library/Application Support/Relay/registry.json`
  - [x] 2.1.3 Implement registry service:
    - [x] 2.1.3.1 `loadRegistry()`: validate schema, initialize with default structure if missing.
    - [x] 2.1.3.2 `saveRegistry()`: deterministic writes, keep version field, maintain ordering.
  - [x] 2.1.4 Implement version key and stub migration switchboard:
    - [x] 2.1.4.1 Add `version` to file.
    - [x] 2.1.4.2 Add migration hook invoked on load.

- [x] 2.2 **Deterministic IO helper**
  - [x] 2.2.1 Implement `ensureDir(path)` helper.
  - [x] 2.2.2 Implement shared `atomicWrite(filePath, content)`:
    - [x] 2.2.2.1 Write to `*.tmp`.
    - [x] 2.2.2.2 `fsync` the tmp file (if applicable in your implementation).
    - [x] 2.2.2.3 Rename tmp → target.
    - [x] 2.2.2.4 Clean up tmp in finally block.
    - [x] 2.2.2.5 Create `.bak` copy of original file prior to overwrite.
  - [x] 2.2.3 Add unit tests for `atomicWrite`:
    - [x] 2.2.3.1 Overwriting existing files.
    - [x] 2.2.3.2 Creating new files.
    - [x] 2.2.3.3 Error handling / tmp cleanup.

- [x] 2.3 **Registry invariants**
  - [x] 2.3.1 Implement auto ID generation (`srv_<slug>`) with collision-safe logic.
  - [x] 2.3.2 Ensure only `apps` overrides (false entries) are persisted.
  - [x] 2.3.3 Implement `effectiveEnabled(agent)` helper:
    - [x] 2.3.3.1 `enabled && (apps[agent] ?? true)`
  - [x] 2.3.4 Add tests confirming overrides + defaults.

- [x] 2.4 **Keychain helper (security guardrail)**
  - [x] 2.4.1 Integrate Keychain bindings (e.g., `keytar` or native module).
  - [x] 2.4.2 Wrap with a `KeychainService`:
    - [x] 2.4.2.1 `service = "com.relay.app"`.
    - [x] 2.4.2.2 `account = "token:<alias>"`.
  - [x] 2.4.3 Implement CRUD:
    - [x] 2.4.3.1 `setSecret(alias, value)`
    - [x] 2.4.3.2 `getSecret(alias)`
    - [x] 2.4.3.3 `deleteSecret(alias)`
  - [x] 2.4.4 Implement reference counting for aliases:
    - [x] 2.4.4.1 Track alias usage across servers.
    - [x] 2.4.4.2 Delete secrets only when no server references remain.
  - [x] 2.4.5 Add tests for:
    - [x] 2.4.5.1 Write, read, update, delete.
    - [] 2.4.5.2 Reference counting behavior.

- [x] 2.5 **Milestone exit gate**
  - [x] 2.5.1 `registry.json` loads/saves deterministically with version key + migration hook and ID generation.
  - [x] 2.5.2 `atomicWrite` + `ensureDir` helpers and Keychain service (service `com.relay.app`) are covered by unit tests, including alias reference counting.

---

## Milestone 3 — MCP Servers UI (CRUD)

- [x] 3.1 **Base UI layout**
  - [x] 3.1.1 Build main layout with:
    - [x] 3.1.1.1 Left / main content area for servers list.
    - [x] 3.1.1.2 Access to Settings (button or nav).
  - [x] 3.1.2 Ensure dark theme visuals and basic Liquid Glass feel.

- [ ] 3.2 **Server list view**
  - [ ] 3.2.1 Display server rows with:
    - [ ] 3.2.1.1 Name.
    - [ ] 3.2.1.2 Endpoint/launch command summary.
    - [ ] 3.2.1.3 Enabled toggle.
    - [ ] 3.2.1.4 “All Apps” master switch.
    - [ ] 3.2.1.5 Per-app pills (Cursor / Claude / Codex) with toggles.
  - [ ] 3.2.2 Apply app detection state:
    - [ ] 3.2.2.1 Disable per-app toggles if that app is not detected.
    - [ ] 3.2.2.2 Reflect master switch state: On / Off / Custom.

- [ ] 3.3 **All Apps logic**
  - [ ] 3.3.1 Implement master toggle behavior:
    - [ ] 3.3.1.1 ON → set every detected app to `true`.
    - [ ] 3.3.1.2 OFF → set every app to `false`.
    - [ ] 3.3.1.3 Custom state when individual toggles differ.
  - [ ] 3.3.2 Ensure changes propagate to registry:
    - [ ] 3.3.2.1 Only save overrides (false entries) into `apps` field.

- [ ] 3.4 **Add/Edit server modal**
  - [ ] 3.4.1 Build modal with fields:
    - [ ] 3.4.1.1 Name.
    - [ ] 3.4.1.2 Launch command + args.
    - [ ] 3.4.1.3 Env editor (key → alias string, e.g., `keychain:<alias>`).
    - [ ] 3.4.1.4 Keychain alias workflow (alias + secret for write/update).
    - [ ] 3.4.1.5 Enabled toggle.
    - [ ] 3.4.1.6 Per-app toggles (respect detection).
  - [ ] 3.4.2 Implement inline validation:
    - [ ] 3.4.2.1 Required fields (name, command, alias when secret is needed).
    - [ ] 3.4.2.2 Uniqueness constraints (ID/name collisions).
  - [ ] 3.4.3 Wire modal actions:
    - [ ] 3.4.3.1 “Save” updates registry + Keychain.
    - [ ] 3.4.3.2 “Cancel” discards changes.

- [ ] 3.5 **CRUD behaviors**
  - [ ] 3.5.1 **Add server**:
    - [ ] 3.5.1.1 Assign ID (`srv_<slug>`).
    - [ ] 3.5.1.2 Default `enabled = true`.
    - [ ] 3.5.1.3 Default All Apps ON (for detected agents).
    - [ ] 3.5.1.4 Write secrets to Keychain.
  - [ ] 3.5.2 **Edit server**:
    - [ ] 3.5.2.1 Update registry entry.
    - [ ] 3.5.2.2 Handle alias reassignment (including Keychain reference counting).
    - [ ] 3.5.2.3 Maintain `.bak` of registry before save.
  - [ ] 3.5.3 **Remove server**:
    - [ ] 3.5.3.1 Delete from registry.
    - [ ] 3.5.3.2 Delete Keychain secrets only when alias unused elsewhere.
    - [ ] 3.5.3.3 Confirm destructive action with user.

- [ ] 3.6 **Milestone exit gate**
  - [ ] 3.6.1 Server list renders with All Apps master switch + per-app pills, reflecting detection state.
  - [ ] 3.6.2 Add/Edit modal saves to registry + Keychain with inline validation and respects alias reuse rules.

---

## Milestone 4 — Detection & Settings

- [ ] 4.1 **Agent detection logic**
  - [ ] 4.1.1 Cursor:
    - [ ] 4.1.1.1 Detect if `~/.cursor` directory exists OR `~/.cursor/mcp.json` file exists.
  - [ ] 4.1.2 Claude Code:
    - [ ] 4.1.2.1 Detect if `~/.claude.json` exists OR `which claude` succeeds.
  - [ ] 4.1.3 Codex:
    - [ ] 4.1.3.1 Detect if `~/.codex/config.toml` exists OR `which codex` succeeds.
  - [ ] 4.1.4 Implement a unified detection service:
    - [ ] 4.1.4.1 Resolve final config paths for each agent.
    - [ ] 4.1.4.2 Cache detection results for the renderer.

- [ ] 4.2 **Settings view**
  - [ ] 4.2.1 Show detection cards per agent:
    - [ ] 4.2.1.1 Detection status (Detected / Not Detected).
    - [ ] 4.2.1.2 Resolved config path.
    - [ ] 4.2.1.3 Read-only project-scope paths (if surfaced).
  - [ ] 4.2.2 Display last sync timestamp.
  - [ ] 4.2.3 Provide `Sync Now` button.
  - [ ] 4.2.4 Reflect disabled state for non-detected app toggles.
  - [ ] 4.2.5 Present update-check card:
    - [ ] 4.2.5.1 Show current version + last-checked timestamp.
    - [ ] 4.2.5.2 Provide manual “Check for Updates” CTA wired to the main-process service.
    - [ ] 4.2.5.3 Display result states (up to date, update available, offline, error).
    - [ ] 4.2.5.4 (Optional for MVP) Add toggle to disable automatic checks and persist the preference.

- [ ] 4.3 **Guardrail checks**
  - [ ] 4.3.1 Ensure detection never writes to disk (read-only).
  - [ ] 4.3.2 Ensure project-scope configs are read-only in the UI (no edit actions).
  - [ ] 4.3.3 Confirm that Settings only triggers the update-check manifest fetch (no telemetry or data sharing) and surfaces the opt-out.
  - [ ] 4.3.4 Ensure update-check responses never include or display secrets/registry data.

- [ ] 4.4 **Milestone exit gate**
  - [ ] 4.4.1 Detection service returns status + paths for Cursor/Claude/Codex and disables undetected app toggles in UI.
  - [ ] 4.4.2 Settings view shows detection cards, last sync timestamp, `Sync Now`, and the update-check card with manual CTA/status.

---

## Milestone 5 — Sync Engine & File IO

- [ ] 5.1 **Sync orchestration**
  - [ ] 5.1.1 Implement `syncNow()` in main process:
    - [ ] 5.1.1.1 For each server in registry:
      - [ ] 5.1.1.1.1 Compute effective per-app enablement with `effectiveEnabled(agent)`.
    - [ ] 5.1.1.2 For each detected app with at least one effective server:
      - [ ] 5.1.1.2.1 Build adapter-specific payload.
      - [ ] 5.1.1.2.2 Call adapter write with `atomicWrite`.
    - [ ] 5.1.1.3 Skip undetected apps; track them for partial success reporting.
  - [ ] 5.1.2 Ensure `Sync Now` runs at most once at a time (sync-in-flight lock).

- [ ] 5.2 **Secrets resolution (Keychain contract)**
  - [ ] 5.2.1 For each server env var referring to `keychain:<alias>`:
    - [ ] 5.2.1.1 Resolve secret via Keychain in memory.
    - [ ] 5.2.1.2 Never write plaintext secrets to registry.
  - [ ] 5.2.2 Handle missing secrets:
    - [ ] 5.2.2.1 Omit env var from generated config.
    - [ ] 5.2.2.2 Surface warning to user (toast or settings error).
  - [ ] 5.2.3 Purge secret values from memory buffers after sync completes.

- [ ] 5.3 **Cursor adapter (`~/.cursor/mcp.json`)**
  - [ ] 5.3.1 Load existing JSON (if present), handling invalid JSON gracefully.
  - [ ] 5.3.2 Ensure `mcpServers` map is present.
  - [ ] 5.3.3 For each Relay-managed server:
    - [ ] 5.3.3.1 Add/update `mcpServers[name]` with `command`, `args`, and resolved `env`.
  - [ ] 5.3.4 For disabled Relay-managed servers:
    - [ ] 5.3.4.1 Remove them from `mcpServers`.
  - [ ] 5.3.5 Preserve all unrelated top-level keys and non-Relay `mcpServers` entries.
  - [ ] 5.3.6 Use `atomicWrite` + `.bak` for final write.
  - [ ] 5.3.7 Add unit tests using fixtures.

- [ ] 5.4 **Claude Code adapter (`~/.claude.json`)**
  - [ ] 5.4.1 Same behavior as Cursor:
    - [ ] 5.4.1.1 Merge into `mcpServers`.
    - [ ] 5.4.1.2 Remove disabled Relay-managed entries.
    - [ ] 5.4.1.3 Preserve other top-level keys.
    - [ ] 5.4.1.4 Use `atomicWrite` + `.bak`.
    - [ ] 5.4.1.5 Add tests with representative fixtures.

- [ ] 5.5 **Codex adapter (`~/.codex/config.toml`)**
  - [ ] 5.5.1 Load existing TOML; handle invalid syntax gracefully.
  - [ ] 5.5.2 For each Relay-managed server:
    - [ ] 5.5.2.1 Manage `[mcp_servers."<name>"]` tables.
    - [ ] 5.5.2.2 Populate `command`, `args`, and `env` (with resolved secrets).
  - [ ] 5.5.3 Remove tables for disabled Relay-managed servers.
  - [ ] 5.5.4 Preserve all non-Relay TOML blocks.
  - [ ] 5.5.5 Use `atomicWrite` + `.bak`.
  - [ ] 5.5.6 Add tests with TOML fixtures.

- [ ] 5.6 **Error taxonomy & UX**
  - [ ] 5.6.1 Define basic error categories:
    - [ ] 5.6.1.1 `ERR_SECRET_MISSING`
    - [ ] 5.6.1.2 `ERR_PERMISSION_DENIED`
    - [ ] 5.6.1.3 `ERR_INVALID_CONFIG`
    - [ ] 5.6.1.4 `ERR_IO_FAILURE`
  - [ ] 5.6.2 Map errors to:
    - [ ] 5.6.2.1 Toast vs modal.
    - [ ] 5.6.2.2 Settings warnings.
  - [ ] 5.6.3 Implement `.bak` restore prompt for invalid JSON/TOML or permission issues:
    - [ ] 5.6.3.1 Options: “Open file”, “Restore backup”, “Skip app”.

- [ ] 5.7 **User feedback**
  - [ ] 5.7.1 Implement toast on sync completion:
    - [ ] 5.7.1.1 `Synced (N apps)` when all detected apps succeeded.
    - [ ] 5.7.1.2 `Synced (N/3 apps)` when some apps were skipped or errored.
  - [ ] 5.7.2 Show partial failure reasons (e.g., missing secret, invalid config).

- [ ] 5.8 **Milestone exit gate**
  - [ ] 5.8.1 `syncNow()` resolves Keychain secrets just-in-time, writes adapter outputs via `atomicWrite`, and surfaces error taxonomy + restore prompts.
  - [ ] 5.8.2 Toast and partial-success messaging reflect detection status (`Synced (N/3 apps)` when applicable).

---

## Milestone 6 — User Flow Wiring

- [ ] 6.1 **Launch flow**
  - [ ] 6.1.1 On app start:
    - [ ] 6.1.1.1 Hydrate registry (initialize if missing).
    - [ ] 6.1.1.2 Run agent detection.
    - [ ] 6.1.1.3 Preload Keychain alias metadata for UI (e.g., which aliases exist).
  - [ ] 6.1.2 Propagate initial state to renderer via IPC.

- [ ] 6.2 **Wire CRUD to services**
  - [ ] 6.2.1 Ensure UI CRUD operations:
    - [ ] 6.2.1.1 Call registry + Keychain services in main process.
    - [ ] 6.2.1.2 Broadcast updated registry state back to renderer.
  - [ ] 6.2.2 Guarantee deterministic writes on every CRUD action (registry `.bak` + atomic write).

- [ ] 6.3 **Sync wiring**
  - [ ] 6.3.1 Wire Settings `Sync Now` button to main process `syncNow()`.
  - [ ] 6.3.2 Wire tray `Sync Now` menu item to same pipeline.
  - [ ] 6.3.3 Disable sync controls while sync is in-flight.
  - [ ] 6.3.4 Surface sync-in-progress state in UI (spinner / subtle indicator).

- [ ] 6.4 **Backup restore UX**
  - [ ] 6.4.1 On encountering invalid JSON/TOML:
    - [ ] 6.4.1.1 Prompt user with:
      - [ ] 6.4.1.1.1 “Open file”
      - [ ] 6.4.1.1.2 “Restore backup”
      - [ ] 6.4.1.1.3 “Skip app”
    - [ ] 6.4.1.2 Implement actions behind each choice.
  - [ ] 6.4.2 Ensure skipping one app doesn’t cancel other app syncs.

- [ ] 6.5 **Update-check orchestration**
  - [ ] 6.5.1 Implement `UpdateCheckService` in the main process that fetches a signed manifest via HTTPS without sending user data.
  - [ ] 6.5.2 Compare manifest version to the running build and emit structured update events (up-to-date / update-available / offline / error).
  - [ ] 6.5.3 Honor the Settings preference: skip scheduled checks when disabled, but allow manual "Check for Updates" invocations.
  - [ ] 6.5.4 Schedule periodic checks (e.g., once every 24h) and reuse the same service for tray/UI notifications.
  - [ ] 6.5.5 Cache last successful check timestamp/result for display in Settings.

- [ ] 6.6 **Milestone exit gate**
  - [ ] 6.6.1 UI CRUD + tray actions all invoke the same registry/Keychain/sync pipeline with in-flight locking.
  - [ ] 6.6.2 `.bak` restore prompts (Open/Restore/Skip) are wired into the UI flow when adapters fail validation.
  - [ ] 6.6.3 Update-check service runs only through the main process, surfaces results in Settings/tray, and respects the opt-out toggle.

---

## Milestone 7 — Packaging & QA

- [ ] 7.1 **Packaging**
  - [ ] 7.1.1 Configure macOS app metadata:
    - [ ] 7.1.1.1 App ID: `com.relay.app`
    - [ ] 7.1.1.2 Product Name: `Relay`
    - [ ] 7.1.1.3 Category: `Developer Tools`
  - [ ] 7.1.2 Configure packaging to produce a signed, hardened `.dmg`.
  - [ ] 7.1.3 Ensure sandbox is enabled in final build.
  - [ ] 7.1.4 Strip any auto-updater integration.
  - [ ] 7.1.5 Restrict network entitlements/permissions to the update-manifest endpoint only.

- [ ] 7.2 **Offline smoke tests**
  - [ ] 7.2.1 Test cold start with network disabled:
    - [ ] 7.2.1.1 App launches.
    - [ ] 7.2.1.2 When auto-checks are disabled, no network attempts are made; when enabled, only the manifest fetch is attempted and fails gracefully offline.
  - [ ] 7.2.2 Test sync with:
    - [ ] 7.2.2.1 All apps detected.
    - [ ] 7.2.2.2 Some apps undetected.
    - [ ] 7.2.2.3 Missing secrets in Keychain.
    - [ ] 7.2.2.4 Invalid existing configs (JSON/TOML).
  - [ ] 7.2.3 Verify `.bak` behavior:
    - [ ] 7.2.3.1 Backups are created on overwrite.
    - [ ] 7.2.3.2 Restore flow works and does not corrupt files.
  - [ ] 7.2.4 Validate update-check UX:
    - [ ] 7.2.4.1 Manual “Check for Updates” works online/offline with clear toasts.
    - [ ] 7.2.4.2 Auto-check schedule respects opt-out toggle and updates last-checked timestamp.

- [ ] 7.3 **Security checks**
  - [ ] 7.3.1 Confirm `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true` in production build.
  - [ ] 7.3.2 Confirm no secrets are logged to console or written to disk outside Keychain.
  - [ ] 7.3.3 Confirm error paths don’t leak secrets.
  - [ ] 7.3.4 Capture network inspector output to prove update-check requests contain no identifiable data (method, headers, body).

- [ ] 7.4 **Manual QA checklist**
  - [ ] 7.4.1 Document manual test cases for:
    - [ ] 7.4.1.1 Launch + tray flows.
    - [ ] 7.4.1.2 Add/Edit/Remove server.
    - [ ] 7.4.1.3 Per-app toggles and All Apps behavior.
    - [ ] 7.4.1.4 Settings, detection, and paths.
    - [ ] 7.4.1.5 Sync behavior for each adapter.
  - [ ] 7.4.2 Capture known limitations that are explicitly post-MVP (drift detection, project-scoped writes, cloud sync, etc.).
  - [ ] 7.4.3 Prepare basic release notes for the MVP `.dmg`.

- [ ] 7.5 **Milestone exit gate**
  - [ ] 7.5.1 Signed, hardened `.dmg` passes offline startup tests and enforces security flags in production.
  - [ ] 7.5.2 Manual QA checklist + release notes completed, documenting coverage of missing secrets, invalid configs, and disabled apps.
  - [ ] 7.5.3 Update-check workflow verified end-to-end: manifest fetch is the only network call, opt-out honored, and notifications surface without auto-installing.
