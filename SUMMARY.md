# Relay Scaffold Summary

## Milestone 1.1 Snapshot
- Established npm workspaces monorepo: shared root scripts, Electron main package, and Vite renderer package.
- Added strict TypeScript baseline (`tsconfig.base.json`) feeding into main/renderer configs for consistent transpilation and typechecking.
- Implemented lint/test tooling (ESLint flat config w/ React + TS rules, Vitest + jsdom harness) and ensured scripts succeed (`build`, `lint`, `test`, `typecheck`).
- Created hardened Electron entry + preload stubs honoring 900×600 dark window with isolation flags and renderer local-load requirement.
- Scaffolded React renderer with CSP-enforced `index.html`, placeholder Liquid Glass styling, and preload bridge consumption (`window.relay.version`).
- Updated `.gitignore` with env, build, cache, and packaging artifacts to keep repo clean as macOS packaging workflows land.

## Next Focus
- Complete Milestone 1.2 shell hardening (tray, richer Liquid Glass treatment) before wiring CSP/IPC/tray tasks per TASKS.md.
