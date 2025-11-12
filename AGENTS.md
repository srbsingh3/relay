# Relay — Tech Lead Agent Playbook

This file is the quick-reference contract for the build agent acting as Relay’s tech lead. Use it to stay aligned with the design lead, the `PRD.md` requirements, and the detailed execution list in `TASKS.md`.

## Read Me First
- `PRD.md` = product truth (what + why).  
- `AGENTS.md` = guardrails + collaboration rules (how to make decisions).  
- `TASKS.md` = step-by-step work orders.  
Keep PRD untouched, update this playbook only when guardrails shift, and let TASKS absorb the granular changes.

## North Stars
- macOS-only Electron app (React/Vite renderer) that manages shared MCP servers for Cursor, Claude Code, and Codex with an offline-first UX; the only permitted network activity is a transparent, read-only update check.
- Secrets live only in Keychain (`service=com.relay.app`, `account=token:<alias>`); registry stores aliases.
- Every sync is deterministic: atomic writes, `.bak` backups, per-app merge logic, and no telemetry.
- Distribution target: signed & hardened `.dmg` with `sandbox=true`, `contextIsolation=true`, `nodeIntegration=false`, strict CSP, and local assets only, with networking locked down to the update manifest endpoint.

## Operating Principles
1. **Security before speed** – honor the Keychain contract, purge in-memory secrets after use, never expose Node globals to the renderer, and block any feature that could leak credentials.
2. **Deterministic IO** – touch configs only after detection passes, use the shared `atomicWrite` helper with tmp/bak flow, and preserve unrelated keys per adapter rules.
3. **Privacy-first networking** – ship all assets locally, disable analytics, limit networking to a single manifest fetch for update checks, respect an opt-out toggle, and verify the app still works with the network disabled.
4. **Scope discipline** – macOS only, no process management, per-project writes, drift detection, or cloud sync until post-MVP.
5. **One pipeline** – UI actions, tray menu, and scheduled syncs all route through the same main-process services for registry, Keychain, detection, and adapters.
6. **Transparent update checks** – run the manifest fetch in the main process, never send secrets or MPC data, reuse one service for scheduled + manual checks, and surface results without auto-installing anything.

## Working Rhythm & Hygiene
- **Always start in `TASKS.md`** – confirm priority, current milestone, and remaining checkboxes before touching code. Update the checklist as tasks close; let TASKS capture the granular status.
- **TodoWrite / personal tracking** – use the TodoWrite tool (or your equivalent scratchpad) to break large checklist items into concrete subtasks while you implement them.
- **Honor existing patterns** – read the surrounding files, mirror established conventions, and prefer evolving shared helpers over one-off fixes.
- **Incremental testing** – run relevant unit/integration tests after each meaningful change; never stack unverified edits.
- **Conventional commits** – when committing, use `type(scope): summary` formatting so history stays machine-readable.
- **Design-facing communication** – Remember the UI owner is not deeply technical. When describing changes, keep explanations simple, intuitive, and focused on how the change affects the user experience. Avoid jargon unless necessary, and add a brief plain‑language summary so the reasoning is easy to follow.

### Before touching code
1. Re-read the relevant section of `TASKS.md`.
2. Inspect the existing implementation in that area; note established patterns.
3. Validate your approach against similar modules to avoid one-off logic.
4. Double-check the change won’t regress current functionality before writing new code.

## Milestone Handshake (see `TASKS.md` for checklists)
1. **Foundation & Shell** – scaffold Electron + Vite, harden BrowserWindow (900×600 dark theme), preload IPC bridge, tray menu, CSP/local assets.
2. **Registry & Keychain Services** – versioned `registry.json`, deterministic writes, ID/migration helpers, and Keychain wrapper with alias reference counting.
3. **Servers UI (CRUD)** – server list with All Apps master switch, per-app pills, Add/Edit modal with inline validation, and Keychain alias workflow.
4. **Detection & Settings** – detector service for Cursor/Claude/Codex, settings cards showing status + paths, last sync timestamp, disabled toggles for undetected apps, and update-check controls/status.
5. **Sync Engine & File IO** – shared `ensureDir`/`atomicWrite`, adapters for Cursor/Claude JSON merges and Codex TOML tables, secret resolution, error taxonomy, and toast feedback.
6. **User Flow Wiring** – connect UI + tray actions to registry/Keychain/sync services, broadcast state updates, provide `.bak` restore prompts for invalid configs, and route update-check scheduling + notifications through the same main-process bridge.
7. **Packaging & QA** – produce signed/hardened `.dmg`, verify offline startup, run adapter edge-case tests (missing secrets, invalid files, disabled apps), and document manual QA.

## Working With Design
- Share data contracts (server row fields, modal states, detection cards, toast copy) before implementation so the Liquid Glass styling can land once.
- Confirm All Apps vs Custom logic and disabled toggle behavior in design reviews before merging UI changes.
- Align on update-check card copy (status text, last-checked timestamp, disable toggle, CTA) so the UX stays transparent and privacy expectations are clear.
- Surface blockers early: missing assets, copy, or interaction changes should be resolved with design before code freeze on each milestone.

## Definition of Done (unchanged from PRD)
- All PRD success criteria met: CRUD works, per-app scopes default ON, deterministic sync with `.bak`, and Keychain is the only secret store.
- Detection reflects real filesystem/binary presence; undetected apps stay disabled and excluded from sync counts.
- `Sync Now` produces correct JSON/TOML for each detected agent with atomic writes and restore prompts for invalid files.
- `.dmg` build launches offline, tray menu works (Open/Sync Now/Quit), and QA checklist plus release notes are complete.
- Update-check service performs a minimal, read-only manifest fetch, surfaces status/notifications in Settings, and honors the user’s opt-out.
