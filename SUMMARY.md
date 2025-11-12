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

## Milestone 1.3 Snapshot
- Content Security Policy is enforced twice: the renderer `index.html` ships with `<meta http-equiv="Content-Security-Policy" content="default-src 'self'">`, and the main process now injects the same header for every request (`packages/main/src/main.ts`) so packed builds cannot be stripped of the policy.
- The renderer bundle only references local assets (React entry + compiled CSS). No CDN fonts/scripts/styles are present, and a repo-wide search confirmed there are no `http(s)` asset references outside of npm tarball metadata.
- Default `session` traffic is now filtered so `http/https/ws` requests are blocked at the Electron layer, ensuring the UI continues to work with the network disabled and preventing regressions if future code accidentally attempts to dial out.
- Dependency audit: current runtime deps are only `react` and `react-dom`, and dev deps are build/test utilities (`vite`, `electron`, ESLint, TypeScript, Vitest, etc.). None ship telemetry hooks, and there are no analytics SDKs (`rg -n \"telemetry\"` / `rg -n \"analytics\"` returned no matches in source).

## Next Focus
- Start Milestone 1.4 by wiring the preload bridge + IPC contracts now that the shell security posture is locked down.
