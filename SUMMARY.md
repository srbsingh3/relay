# Relay Scaffold Summary

## Milestone 1.1 Snapshot
- Established npm workspaces monorepo: shared root scripts, Electron main package, and Vite renderer package.
- Added strict TypeScript baseline (`tsconfig.base.json`) feeding into main/renderer configs for consistent transpilation and typechecking.
- Implemented lint/test tooling (ESLint flat config w/ React + TS rules, Vitest + jsdom harness) and ensured scripts succeed (`build`, `lint`, `test`, `typecheck`).
- Created hardened Electron entry + preload stubs honoring 900×600 dark window with isolation flags and renderer local-load requirement.
- Scaffolded React renderer with CSP-enforced `index.html`, placeholder Liquid Glass styling, and preload bridge consumption (`window.relay.version`).
- Updated `.gitignore` with env, build, cache, and packaging artifacts to keep repo clean as macOS packaging workflows land.

## Milestone 1.2 Snapshot
- Electron window setup now asserts a single 900×600 shell, hides the native menu, applies macOS vibrancy (when available), and guarantees the renderer bundle is a local `index.html` before loading.
- Added guard rails for offline-only navigation by denying new windows + non-file navigations, while keeping `contextIsolation`, `nodeIntegration=false`, and `sandbox=true` in place.
- Renderer landing view upgraded with a clearer Liquid Glass surface, status grid, and offline badges so design can iterate on the layout without extra wiring.

## Next Focus
- Move into Milestone 1.3 (CSP/offline guardrails) to audit dependencies, lock CSP headers, and confirm the app is network silent before starting on preload/IPCs.
