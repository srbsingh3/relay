# Relay — Tech Lead Agent Playbook

This file is the quick-reference contract for the build agent acting as Relay's tech lead. Use it to stay aligned with the design lead, the `PRD.md` requirements, and the detailed execution list in `TASKS.md`.

## Read Me First
- `PRD.md` = product truth (what + why).
- `AGENTS.md` = guardrails + collaboration rules (how to make decisions).
- `TASKS.md` = step-by-step work orders.
Keep PRD untouched, update this playbook only when guardrails shift, and let TASKS absorb the granular changes.

## North Stars
- macOS-only Electron app (React/Vite renderer) that manages shared MCP servers for Cursor, Claude Code, and Codex with an offline-first UX; the only permitted network activity is a transparent, read-only update check.
- **Paste-to-add simplicity**: Users paste MCP config JSON from provider docs → Relay parses, detects placeholders, prompts for secrets, and syncs to all apps. No manual forms.
- **Modern developer aesthetic**: Linear/Cursor-inspired UI with Dark/Light/System theme support. Motion is subtle and intentional.
- Supports both **URL-based** (HTTP endpoint + headers) and **command-based** (npx/binary + args) MCP servers.
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
1. **Foundation & Shell** – scaffold Electron + Vite, harden BrowserWindow (1100×700), preload IPC bridge, tray menu, CSP/local assets.
2. **Registry & Keychain Services** – versioned `registry.json`, deterministic writes, ID/migration helpers, and Keychain wrapper with alias reference counting.
3. **Servers UI (CRUD)** – server list with All Apps master switch, per-app pills, Add/Edit modal with inline validation, and Keychain alias workflow.
3A. **UX Refresh (Paste-to-Add & Modern UI)** – [CURRENT PRIORITY] Replace manual forms with paste-to-add flow, implement theme system (Dark/Light/System), modernize UI to Linear/Cursor aesthetic, add URL server support alongside command servers.
4. **Detection & Settings** – detector service for Cursor/Claude/Codex, settings cards showing status + paths, last sync timestamp, disabled toggles for undetected apps, theme selector, and update-check controls/status.
5. **Sync Engine & File IO** – shared `ensureDir`/`atomicWrite`, adapters for Cursor/Claude JSON merges and Codex TOML tables (both URL and command server types), secret resolution, error taxonomy, and toast feedback.
6. **User Flow Wiring** – connect UI + tray actions to registry/Keychain/sync services, broadcast state updates, provide `.bak` restore prompts for invalid configs, and route update-check scheduling + notifications through the same main-process bridge.
7. **Packaging & QA** – produce signed/hardened `.dmg`, verify offline startup, run adapter edge-case tests (missing secrets, invalid files, disabled apps, both server types), and document manual QA.

## Working With Design
- **Design language**: Linear/Cursor-inspired developer aesthetic. Clean, minimal, focused. Motion is subtle and intentional (transitions only, no gratuitous animations).
- **Theme system**: Dark/Light/System toggle with CSS custom properties. Dark mode is the default for developer appeal.
- Share data contracts (server card fields, paste-to-add flow states, detection cards, toast copy) before implementation so Tailwind utility classes and shadcn/ui primitives can be applied once and reused across screens.
- Prefer Tailwind + shadcn/ui over ad-hoc CSS; if a layout or interaction can't be expressed cleanly with the existing primitives, sync with design before introducing custom styling or one-off components.
- **Paste-to-add flow**: Three-step wizard (paste → secrets → preview). Keep it simple—users should feel like they're just copying from docs.
- **Server cards**: Prominent master toggle is the primary interaction. Per-app toggles are secondary/smaller. Type badges (URL/Command) help users understand what they're configuring.
- Confirm All Apps vs Custom logic and disabled toggle behavior in design reviews before merging UI changes.
- Align on update-check card copy (status text, last-checked timestamp, disable toggle, CTA) so the UX stays transparent and privacy expectations are clear.
- Surface blockers early: missing assets, copy, or interaction changes should be resolved with design before code freeze on each milestone.

## Definition of Done
- **Paste-to-add works end-to-end**: Users can paste MCP config JSON → placeholders are detected → secrets are prompted and stored in Keychain → server is saved to registry.
- **Theme system functional**: Dark/Light/System toggle persists preference and applies on restart without reload.
- **Both server types supported**: URL-based and command-based servers sync correctly to all adapters (Cursor, Claude, Codex).
- **Modern UI**: Linear/Cursor-inspired aesthetic with card-based server list, prominent master toggles, and clean visual hierarchy.
- All PRD success criteria met: per-app scopes default ON, deterministic sync with `.bak`, and Keychain is the only secret store.
- Detection reflects real filesystem/binary presence; undetected apps stay disabled and excluded from sync counts.
- `Sync Now` produces correct JSON/TOML for each detected agent (both URL and command types) with atomic writes and restore prompts for invalid files.
- `.dmg` build launches offline, tray menu works (Open/Sync Now/Quit), and QA checklist plus release notes are complete.
- Update-check service performs a minimal, read-only manifest fetch, surfaces status/notifications in Settings, and honors the user's opt-out.
