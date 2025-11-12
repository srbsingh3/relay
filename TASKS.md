# Relay — TASKS (macOS MVP)

This checklist mirrors the build phases in `AGENTS.md` and the contracts in `PRD.md`.
Use it as the primary execution plan for the macOS MVP.

## How to Use This Checklist
1. Start each milestone by rereading the “Milestone Handshake” section in `AGENTS.md` so the intent is fresh.
2. Work through the checkboxes below; add sub-tasks in your tooling if a step needs deeper tracking.
3. Keep `PRD.md` open for data contracts/guardrails when making design or implementation decisions.

---

## Milestone 1 — Foundation & Shell

- [ ] **Scaffold project**
  - [ ] Create Electron + Vite monorepo / packages structure.
  - [ ] Set up shared TypeScript config, linting, and testing baseline.
  - [ ] Add `PRD.md`, `AGENTS.md`, and `TASKS.md` to the repo as living references.

- [ ] **Secure BrowserWindow shell**
  - [ ] Create main Electron process entry.
  - [ ] Configure a single BrowserWindow:
    - [ ] Size: 900×600.
    - [ ] Dark theme and base Liquid Glass aesthetic (can be basic initially).
  - [ ] Enforce Electron security flags:
    - [ ] `contextIsolation = true`
    - [ ] `nodeIntegration = false`
    - [ ] `sandbox = true`
  - [ ] Load UI via local `index.html` only (no remote URLs).

- [ ] **Content Security Policy / offline guardrails**
  - [ ] Add CSP: `default-src 'self'`.
  - [ ] Ensure no fonts/scripts/styles are loaded from remote CDNs.
  - [ ] Audit dependencies for telemetry/analytics and disable/remove them.
  - [ ] Confirm app functions with network disabled (no network calls made on launch).

- [ ] **Preload + IPC contract**
  - [ ] Implement preload script exposing a minimal, typed IPC bridge.
  - [ ] Define IPC channels for:
    - [ ] Registry read/write.
    - [ ] Keychain lookups.
    - [ ] Agent detection results.
    - [ ] Sync invocation + status.
  - [ ] Ensure preload never exposes Node primitives directly to the renderer.

- [ ] **Tray menu**
  - [ ] Add tray icon and menu with:
    - [ ] “Open Relay”
    - [ ] “Sync Now”
    - [ ] “Quit”
  - [ ] Wire “Open Relay” to show/focus BrowserWindow.
  - [ ] Wire “Sync Now” to the same sync flow used by Settings.
  - [ ] Ensure tray menu works correctly when app is hidden and on cold start.

- [ ] **Milestone exit gate**
  - [ ] BrowserWindow uses `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true`, and only loads local assets.
  - [ ] Tray menu (Open/Sync Now/Quit) works after a cold start with the network disabled.

---

## Milestone 2 — Registry & Keychain Services

- [ ] **Registry schema + file**
  - [ ] Define TypeScript types mirroring `PRD.md` registry sample:
    - [ ] `version`, `servers[]`, `launch`, `env`, `apps`, etc.
  - [ ] Implement registry location:
    - [ ] `~/Library/Application Support/Relay/registry.json`
  - [ ] Implement registry service:
    - [ ] `loadRegistry()`: validate schema, initialize with default structure if missing.
    - [ ] `saveRegistry()`: deterministic writes, keep version field, maintain ordering.
  - [ ] Implement version key and stub migration switchboard:
    - [ ] Add `version` to file.
    - [ ] Add migration hook invoked on load.

- [ ] **Deterministic IO helper**
  - [ ] Implement `ensureDir(path)` helper.
  - [ ] Implement shared `atomicWrite(filePath, content)`:
    - [ ] Write to `*.tmp`.
    - [ ] `fsync` the tmp file (if applicable in your implementation).
    - [ ] Rename tmp → target.
    - [ ] Clean up tmp in finally block.
    - [ ] Create `.bak` copy of original file prior to overwrite.
  - [ ] Add unit tests for `atomicWrite`:
    - [ ] Overwriting existing files.
    - [ ] Creating new files.
    - [ ] Error handling / tmp cleanup.

- [ ] **Registry invariants**
  - [ ] Implement auto ID generation (`srv_<slug>`) with collision-safe logic.
  - [ ] Ensure only `apps` overrides (false entries) are persisted.
  - [ ] Implement `effectiveEnabled(agent)` helper:
    - [ ] `enabled && (apps[agent] ?? true)`
  - [ ] Add tests confirming overrides + defaults.

- [ ] **Keychain helper (security guardrail)**
  - [ ] Integrate Keychain bindings (e.g., `keytar` or native module).
  - [ ] Wrap with a `KeychainService`:
    - [ ] `service = "com.relay.app"`.
    - [ ] `account = "token:<alias>"`.
  - [ ] Implement CRUD:
    - [ ] `setSecret(alias, value)`
    - [ ] `getSecret(alias)`
    - [ ] `deleteSecret(alias)`
  - [ ] Implement reference counting for aliases:
    - [ ] Track alias usage across servers.
    - [ ] Delete secrets only when no server references remain.
  - [ ] Add tests for:
    - [ ] Write, read, update, delete.
    - [ ] Reference counting behavior.

- [ ] **Milestone exit gate**
  - [ ] `registry.json` loads/saves deterministically with version key + migration hook and ID generation.
  - [ ] `atomicWrite` + `ensureDir` helpers and Keychain service (service `com.relay.app`) are covered by unit tests, including alias reference counting.

---

## Milestone 3 — MCP Servers UI (CRUD)

- [ ] **Base UI layout**
  - [ ] Build main layout with:
    - [ ] Left / main content area for servers list.
    - [ ] Access to Settings (button or nav).
  - [ ] Ensure dark theme visuals and basic Liquid Glass feel.

- [ ] **Server list view**
  - [ ] Display server rows with:
    - [ ] Name.
    - [ ] Endpoint/launch command summary.
    - [ ] Enabled toggle.
    - [ ] “All Apps” master switch.
    - [ ] Per-app pills (Cursor / Claude / Codex) with toggles.
  - [ ] Apply app detection state:
    - [ ] Disable per-app toggles if that app is not detected.
    - [ ] Reflect master switch state: On / Off / Custom.

- [ ] **All Apps logic**
  - [ ] Implement master toggle behavior:
    - [ ] ON → set every detected app to `true`.
    - [ ] OFF → set every app to `false`.
    - [ ] Custom state when individual toggles differ.
  - [ ] Ensure changes propagate to registry:
    - [ ] Only save overrides (false entries) into `apps` field.

- [ ] **Add/Edit server modal**
  - [ ] Build modal with fields:
    - [ ] Name.
    - [ ] Launch command + args.
    - [ ] Env editor (key → alias string, e.g., `keychain:<alias>`).
    - [ ] Keychain alias workflow (alias + secret for write/update).
    - [ ] Enabled toggle.
    - [ ] Per-app toggles (respect detection).
  - [ ] Implement inline validation:
    - [ ] Required fields (name, command, alias when secret is needed).
    - [ ] Uniqueness constraints (ID/name collisions).
  - [ ] Wire modal actions:
    - [ ] “Save” updates registry + Keychain.
    - [ ] “Cancel” discards changes.

- [ ] **CRUD behaviors**
  - [ ] **Add server**:
    - [ ] Assign ID (`srv_<slug>`).
    - [ ] Default `enabled = true`.
    - [ ] Default All Apps ON (for detected agents).
    - [ ] Write secrets to Keychain.
  - [ ] **Edit server**:
    - [ ] Update registry entry.
    - [ ] Handle alias reassignment (including Keychain reference counting).
    - [ ] Maintain `.bak` of registry before save.
  - [ ] **Remove server**:
    - [ ] Delete from registry.
    - [ ] Delete Keychain secrets only when alias unused elsewhere.
    - [ ] Confirm destructive action with user.

- [ ] **Milestone exit gate**
  - [ ] Server list renders with All Apps master switch + per-app pills, reflecting detection state.
  - [ ] Add/Edit modal saves to registry + Keychain with inline validation and respects alias reuse rules.

---

## Milestone 4 — Detection & Settings

- [ ] **Agent detection logic**
  - [ ] Cursor:
    - [ ] Detect if `~/.cursor` directory exists OR `~/.cursor/mcp.json` file exists.
  - [ ] Claude Code:
    - [ ] Detect if `~/.claude.json` exists OR `which claude` succeeds.
  - [ ] Codex:
    - [ ] Detect if `~/.codex/config.toml` exists OR `which codex` succeeds.
  - [ ] Implement a unified detection service:
    - [ ] Resolve final config paths for each agent.
    - [ ] Cache detection results for the renderer.

- [ ] **Settings view**
  - [ ] Show detection cards per agent:
    - [ ] Detection status (Detected / Not Detected).
    - [ ] Resolved config path.
    - [ ] Read-only project-scope paths (if surfaced).
  - [ ] Display last sync timestamp.
  - [ ] Provide `Sync Now` button.
  - [ ] Reflect disabled state for non-detected app toggles.

- [ ] **Guardrail checks**
  - [ ] Ensure detection never writes to disk (read-only).
  - [ ] Ensure project-scope configs are read-only in the UI (no edit actions).
  - [ ] Confirm that settings do not introduce any network calls.

- [ ] **Milestone exit gate**
  - [ ] Detection service returns status + paths for Cursor/Claude/Codex and disables undetected app toggles in UI.
  - [ ] Settings view shows detection cards, last sync timestamp, and `Sync Now` entry point.

---

## Milestone 5 — Sync Engine & File IO

- [ ] **Sync orchestration**
  - [ ] Implement `syncNow()` in main process:
    - [ ] For each server in registry:
      - [ ] Compute effective per-app enablement with `effectiveEnabled(agent)`.
    - [ ] For each detected app with at least one effective server:
      - [ ] Build adapter-specific payload.
      - [ ] Call adapter write with `atomicWrite`.
    - [ ] Skip undetected apps; track them for partial success reporting.
  - [ ] Ensure `Sync Now` runs at most once at a time (sync-in-flight lock).

- [ ] **Secrets resolution (Keychain contract)**
  - [ ] For each server env var referring to `keychain:<alias>`:
    - [ ] Resolve secret via Keychain in memory.
    - [ ] Never write plaintext secrets to registry.
  - [ ] Handle missing secrets:
    - [ ] Omit env var from generated config.
    - [ ] Surface warning to user (toast or settings error).
  - [ ] Purge secret values from memory buffers after sync completes.

- [ ] **Cursor adapter (`~/.cursor/mcp.json`)**
  - [ ] Load existing JSON (if present), handling invalid JSON gracefully.
  - [ ] Ensure `mcpServers` map is present.
  - [ ] For each Relay-managed server:
    - [ ] Add/update `mcpServers[name]` with `command`, `args`, and resolved `env`.
  - [ ] For disabled Relay-managed servers:
    - [ ] Remove them from `mcpServers`.
  - [ ] Preserve all unrelated top-level keys and non-Relay `mcpServers` entries.
  - [ ] Use `atomicWrite` + `.bak` for final write.
  - [ ] Add unit tests using fixtures.

- [ ] **Claude Code adapter (`~/.claude.json`)**
  - [ ] Same behavior as Cursor:
    - [ ] Merge into `mcpServers`.
    - [ ] Remove disabled Relay-managed entries.
    - [ ] Preserve other top-level keys.
    - [ ] Use `atomicWrite` + `.bak`.
    - [ ] Add tests with representative fixtures.

- [ ] **Codex adapter (`~/.codex/config.toml`)**
  - [ ] Load existing TOML; handle invalid syntax gracefully.
  - [ ] For each Relay-managed server:
    - [ ] Manage `[mcp_servers."<name>"]` tables.
    - [ ] Populate `command`, `args`, and `env` (with resolved secrets).
  - [ ] Remove tables for disabled Relay-managed servers.
  - [ ] Preserve all non-Relay TOML blocks.
  - [ ] Use `atomicWrite` + `.bak`.
  - [ ] Add tests with TOML fixtures.

- [ ] **Error taxonomy & UX**
  - [ ] Define basic error categories:
    - [ ] `ERR_SECRET_MISSING`
    - [ ] `ERR_PERMISSION_DENIED`
    - [ ] `ERR_INVALID_CONFIG`
    - [ ] `ERR_IO_FAILURE`
  - [ ] Map errors to:
    - [ ] Toast vs modal.
    - [ ] Settings warnings.
  - [ ] Implement `.bak` restore prompt for invalid JSON/TOML or permission issues:
    - [ ] Options: “Open file”, “Restore backup”, “Skip app”.

- [ ] **User feedback**
  - [ ] Implement toast on sync completion:
    - [ ] `Synced (N apps)` when all detected apps succeeded.
    - [ ] `Synced (N/3 apps)` when some apps were skipped or errored.
  - [ ] Show partial failure reasons (e.g., missing secret, invalid config).

- [ ] **Milestone exit gate**
  - [ ] `syncNow()` resolves Keychain secrets just-in-time, writes adapter outputs via `atomicWrite`, and surfaces error taxonomy + restore prompts.
  - [ ] Toast and partial-success messaging reflect detection status (`Synced (N/3 apps)` when applicable).

---

## Milestone 6 — User Flow Wiring

- [ ] **Launch flow**
  - [ ] On app start:
    - [ ] Hydrate registry (initialize if missing).
    - [ ] Run agent detection.
    - [ ] Preload Keychain alias metadata for UI (e.g., which aliases exist).
  - [ ] Propagate initial state to renderer via IPC.

- [ ] **Wire CRUD to services**
  - [ ] Ensure UI CRUD operations:
    - [ ] Call registry + Keychain services in main process.
    - [ ] Broadcast updated registry state back to renderer.
  - [ ] Guarantee deterministic writes on every CRUD action (registry `.bak` + atomic write).

- [ ] **Sync wiring**
  - [ ] Wire Settings `Sync Now` button to main process `syncNow()`.
  - [ ] Wire tray `Sync Now` menu item to same pipeline.
  - [ ] Disable sync controls while sync is in-flight.
  - [ ] Surface sync-in-progress state in UI (spinner / subtle indicator).

- [ ] **Backup restore UX**
  - [ ] On encountering invalid JSON/TOML:
    - [ ] Prompt user with:
      - [ ] “Open file”
      - [ ] “Restore backup”
      - [ ] “Skip app”
    - [ ] Implement actions behind each choice.
  - [ ] Ensure skipping one app doesn’t cancel other app syncs.

- [ ] **Milestone exit gate**
  - [ ] UI CRUD + tray actions all invoke the same registry/Keychain/sync pipeline with in-flight locking.
  - [ ] `.bak` restore prompts (Open/Restore/Skip) are wired into the UI flow when adapters fail validation.

---

## Milestone 7 — Packaging & QA

- [ ] **Packaging**
  - [ ] Configure macOS app metadata:
    - [ ] App ID: `com.relay.app`
    - [ ] Product Name: `Relay`
    - [ ] Category: `Developer Tools`
  - [ ] Configure packaging to produce a signed, hardened `.dmg`.
  - [ ] Ensure sandbox is enabled in final build.
  - [ ] Strip any auto-updater integration.

- [ ] **Offline smoke tests**
  - [ ] Test cold start with network disabled:
    - [ ] App launches.
    - [ ] No network attempts are made.
  - [ ] Test sync with:
    - [ ] All apps detected.
    - [ ] Some apps undetected.
    - [ ] Missing secrets in Keychain.
    - [ ] Invalid existing configs (JSON/TOML).
  - [ ] Verify `.bak` behavior:
    - [ ] Backups are created on overwrite.
    - [ ] Restore flow works and does not corrupt files.

- [ ] **Security checks**
  - [ ] Confirm `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true` in production build.
  - [ ] Confirm no secrets are logged to console or written to disk outside Keychain.
  - [ ] Confirm error paths don’t leak secrets.

- [ ] **Manual QA checklist**
  - [ ] Document manual test cases for:
    - [ ] Launch + tray flows.
    - [ ] Add/Edit/Remove server.
    - [ ] Per-app toggles and All Apps behavior.
    - [ ] Settings, detection, and paths.
    - [ ] Sync behavior for each adapter.
  - [ ] Capture known limitations that are explicitly post-MVP (drift detection, project-scoped writes, cloud sync, etc.).
  - [ ] Prepare basic release notes for the MVP `.dmg`.

- [ ] **Milestone exit gate**
  - [ ] Signed, hardened `.dmg` passes offline startup tests and enforces security flags in production.
  - [ ] Manual QA checklist + release notes completed, documenting coverage of missing secrets, invalid configs, and disabled apps.
