# Relay UI — Style Inventory

This document captures every UI-facing style, component, or pattern currently in the repository so we can standardize visuals and remove unused code safely. Each entry calls out the purpose, visual characteristics, source files, usage sites, and any inconsistencies to revisit during the redesign.

## ✅ Phase 1 Complete: shadcn/ui Foundation

### New shadcn Components Added
- **Switch**: Radix-based toggle component for enable/disable functionality
- **Separator**: Visual divider component for layouts
- **Label**: Enhanced with `uppercase` variant for form field labels
- **Alert**: Success/warning/error variants with proper semantic tokens
- **Progress**: Radix-based progress indicator component

### Enhanced Badge Variants
- Added `success`, `warning`, `error`, `muted` semantic variants
- All status patterns now use consistent token-based colors

### Semantic Color System Standardized
- **New tokens**: `--success`, `--warning`, `--success-foreground`, `--warning-foreground`
- **Replaced raw colors**: All `rose-`, `emerald-`, `sky-`, `slate-`, `white-` literals now use semantic tokens
- **Consistent error handling**: All destructive states use `text-destructive` token
- **Modal updated**: ServerModal fully migrated to theme token system

---

## Foundations

### Theme tokens (`packages/renderer/src/theme.css:1`)
- **Purpose**: Defines light/dark HSL tokens for backgrounds, surfaces, typography, charts, radius tokens, and sidebar colors so Tailwind utilities map back to a shared palette.
- **Key visuals**: `--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--border`, chart hues, and `--radius` family. The `.dark` block in the same file overrides each token for dark mode.
- **Usage**: Referenced indirectly via Tailwind classes such as `bg-background`, `text-foreground`, `border-border`, etc., throughout `packages/renderer/src/App.tsx` (e.g., lines 1092, 829, 957) and `packages/renderer/src/components/ServerModal.tsx:354`.
- **Notes**: Most renderer views respect these tokens, but ServerModal mixes raw slate/white Tailwind colors with token-based ones, yielding a different tone from the main shell.

### Base layer & custom utilities (`packages/renderer/src/styles.css:1`)
- **Purpose**: Imports Tailwind (`@import 'tailwindcss'`) and `tw-animate-css`, sets the dark variant shorthand, and applies global scrollbar + focus styles.
- **Key visuals**: Global `@layer base` applies `border-border` and `outline-ring/50` to `*`, hides scrollbars until `.scrolling` is set, forces body to `bg-background text-foreground`, and ensures touch-friendly input font sizes.
- **Usage**: Applied globally via `import './styles.css'` in `App.tsx:2` and `main.tsx:4`. Scrollbar styling pairs with the `useScrollDetection` hook in `App.tsx:297`.
- **Notes**: Utility classes `@utility container`, `@utility no-scrollbar`, `@utility faded-bottom`, and `.CollapsibleContent` animations are not referenced anywhere yet—safe cleanup candidates once confirmed. `tw-animate-css` is only needed for the dropdown menu component (which is currently unused).

### Class merging helper (`packages/renderer/src/lib/utils.ts:1`)
- **Purpose**: Supplies the `cn` helper that combines `clsx` with `tailwind-merge` to dedupe utility classes.
- **Usage**: Imported in most components (App, ServerModal, inputs, dropdown). Essential for merging variant class strings.
- **Notes**: Any new style helper should funnel through `cn` to avoid conflicting Tailwind utilities.

### Theme provider (`packages/renderer/src/components/theme-provider.tsx:1`)
- **Purpose**: Persists the selected theme in `localStorage`, toggles `light`/`dark` classes on `<html>`, and exposes `useTheme`.
- **Usage**: Wraps the entire app at `App.tsx:1092`. `ModeToggle` drives it (see below).
- **Notes**: Default theme is `"dark"` via `ThemeProvider` props, but `"system"` remains an option.

---

## Layout & Navigation

### App shell (`packages/renderer/src/App.tsx:1092`)
- **Purpose**: Root `<main>` sets the desktop Electron chrome with `relative flex min-h-screen bg-background font-sans text-foreground antialiased`.
- **Key visuals**: Fixed drag strip (`className="fixed left-0 right-0 top-0 z-50 h-6"`) and two-column layout with an always-visible sidebar (`md:flex`) and content area offset by `md:ml-[240px]`.
- **Usage**: All renderer routes live inside this shell.
- **Notes**: Inline `WebkitAppRegion` styles appear on the drag strip and header; verify they remain after redesign.

### Sidebar navigation (`packages/renderer/src/App.tsx:1102`)
- **Purpose**: Vertical nav for “MCP Servers / Settings / Sync / Updates”.
- **Key visuals**: Buttons use `group flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition` plus conditional `bg-accent text-accent-foreground` for the active section.
- **Usage**: Only in App shell. Icons are inline SVGs defined earlier in `App.tsx`.
- **Notes**: Currently desktop-only (`hidden md:flex`). Consider responsive behavior later.

### Header hero (`packages/renderer/src/App.tsx:1138`)
- **Purpose**: Introduces the product name and description at the top of the content column.
- **Key visuals**: Uppercase eyebrow (`text-xs font-semibold uppercase tracking-[0.3em] text-primary/80`), large title `text-3xl sm:text-4xl`, muted description text, ModeToggle, and an outline Settings button.
- **Usage**: Present at the top of every section view.
- **Notes**: Header text relies on repeated Tailwind literals; factoring into shared typography tokens could simplify future updates.

### Section switcher (`packages/renderer/src/App.tsx:1163`)
- **Purpose**: Keeps each section (servers/settings/sync/updates) mounted for transitions.
- **Key visuals**: Container `relative min-h-[420px]` with each `<section>` toggling between `relative opacity-100` and `absolute inset-0 -z-10 pointer-events-none opacity-0` inside a `transition-all duration-300`.
- **Usage**: All four section cards are inserted via the `sectionContent` map.
- **Notes**: JavaScript-controlled `data-section` is also how the scroll detection hook finds scrollable regions.

---

## UI Primitives

### Buttons (`packages/renderer/src/components/ui/button.tsx:6`)
- **Purpose**: Shared CTA component with size + variant control using class-variance-authority.
- **Key visuals**:
  ```ts
  const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 ...",
    { variants: { variant: { default, destructive, outline, secondary, ghost, link }, size: { default, sm, lg, icon } } }
  );
  ```
- **Usage**: Outline buttons for secondary actions (`App.tsx:839`, `App.tsx:1058`, `ServerModal.tsx:458`), ghost buttons for “Edit/Remove” (`App.tsx:840`, `App.tsx:850`), default buttons for primaries such as “Sync Now” (`App.tsx:1006`) and modal “Save” (`ServerModal.tsx:525`), icon size for `ModeToggle` (`mode-toggle.tsx:18`).
- **Notes**: `destructive`, `secondary`, and `link` variants plus the `lg` size are never used; we can drop or restyle them later if not needed.

### Cards (`packages/renderer/src/components/ui/card.tsx:6`)
- **Purpose**: Standard container for every dashboard section.
- **Key visuals**: `flex flex-col gap-6 rounded-xl border border-border p-6 bg-card text-card-foreground`, with header/title/description helpers.
- **Usage**: Wraps the Servers, Settings, Sync, and Updates sections (`App.tsx:820`, `App.tsx:948`, `App.tsx:998`, `App.tsx:1022`).
- **Notes**: Padding is hard-coded to `p-6`; if we need denser layouts, consider exposing padding variants.

### Inputs & textarea (`packages/renderer/src/components/ui/input.tsx:6`, `textarea.tsx:6`)
- **Purpose**: Form-ready fields that integrate Tailwind focus rings and error states.
- **Key visuals**: Rounded corners, `border-input bg-background`, focus ring on `focus-visible`.
- **Usage**: Only inside `ServerModal` for the server name, command, args, and Keychain alias rows (`ServerModal.tsx:369-498`).
- **Notes**: No small/large variants; responsive fonts rely on the global base rule.

### Badge (`packages/renderer/src/components/ui/badge.tsx:5`)
- **Purpose**: Status chips for detection/sync/update state.
- **Key visuals**: Rounded pill with border, uppercase capability via extra classes at the call site. Available variants: `default`, `secondary`, `destructive`, `outline`, `accent`.
- **Usage**: Only `variant="outline"` is used (detection state `App.tsx:963`, sync state `App.tsx:1003`, update state `App.tsx:1033`).
- **Notes**: The other variants are unused and could be removed or recolored later.

### Dropdown menu (unused) (`packages/renderer/src/components/ui/dropdown-menu.tsx:1`)
- **Purpose**: Radix UI wrapper with animated content styles (`data-[state=open]:animate-in`).
- **Usage**: Not imported anywhere yet.
- **Notes**: Since it’s unused, the supporting `tw-animate-css` import might also be removable unless future work requires menus.

### Mode toggle (`packages/renderer/src/components/mode-toggle.tsx:6`)
- **Purpose**: Outline `Button` that swaps the theme via `useTheme`.
- **Key visuals**: Icon-size button with overlapping Sun/Moon icons and transitions (`rotate-90/scale-0` classes).
- **Usage**: Lives in the header (`App.tsx:1150`).
- **Notes**: Inline `style={{ WebkitAppRegion: 'no-drag' }}` prevents accidental dragging; retain if header stays draggable.

---

## Feedback & Status Patterns

### Scroll behavior (`packages/renderer/src/App.tsx:297` + `styles.css:7`)
- **Purpose**: `useScrollDetection` adds/removes a `.scrolling` class on `<html>` and `<body>` so the base CSS can fade scrollbar thumbs in/out.
- **Key visuals**: Scrollbar thumbs remain transparent until the class is set, then use `var(--border)` with a subtle hover mix.
- **Usage**: Applied globally via the hook invoked in `App.tsx:394`.
- **Notes**: Any new scrollable regions should keep the `[data-section]` attribute or include `.overflow-auto` so the hook can attach listeners.

### Error text pattern (`packages/renderer/src/App.tsx:832`, `ServerModal.tsx:374`)
- **Purpose**: Simple error messaging for load/mutation failures and validation issues.
- **Key visuals**: Semantic `text-destructive` token for all error states, bordered error box for submission failures (`ServerModal.tsx:517`).
- **Usage**: `loadError`, `mutationError`, `detectionError`, `updateError`, and form field validation states.
- **Notes**: ✅ Standardized to use semantic `text-destructive` token consistently across all error states.

### Empty states (`packages/renderer/src/App.tsx:820`)
- **Purpose**: Communicate when no servers exist.
- **Key visuals**: Rounded `border-border/60 bg-muted/60 p-6` block containing a `text-base` headline and muted body copy.
- **Usage**: Displayed when `servers.length === 0` in the server list.
- **Notes**: Could be extracted into a reusable component if more empty states appear.

---

## Domain-Specific Patterns

### Server list rows (`packages/renderer/src/App.tsx:825`)
- **Purpose**: Primary CRUD surface for registry entries.
- **Key visuals**: Each `<li>` uses `rounded-lg border border-border bg-card p-5`, with the command string wrapped in a `code` block (`rounded-md bg-muted/60 px-3 py-1 font-mono text-sm`).
- **Usage**: Rendered for each server in `servers.map`.
- **Notes**: Server names use theme tokens, but command chips rely on `bg-muted/60` overlays for readability.

### Server action toolbar (`packages/renderer/src/App.tsx:840`)
- **Purpose**: Row of buttons for editing, removing, and showing the enabled state.
- **Key visuals**: `Button` ghost variant for text actions, and a custom `button` for the enabled badge: `rounded-md border px-3 py-1.5 text-xs font-semibold transition` with either emerald or muted colors.
- **Usage**: Inline inside each server row’s header.
- **Notes**: Enabled badge is not interactive (no onClick) yet but styled like a toggle; clarify intent during redesign.

### All-app master switch (`packages/renderer/src/App.tsx:186`, `App.tsx:872`)
- **Purpose**: Applies uniform on/off/custom states per server.
- **Key visuals**:
  ```ts
  const masterStateStyles = {
    on: 'border-success/60 bg-success/10 text-success dark:text-success',
    off: 'border-border bg-muted text-muted-foreground',
    custom: 'border-warning/70 bg-warning/15 text-warning dark:text-warning'
  };
  ```
  Buttons use `rounded-md border px-4 py-2 text-xs font-semibold transition`.
- **Usage**: In the "All apps" card inside each server list row.
- **Notes**: ✅ Migrated to semantic tokens (`success`, `warning`) for consistent theming.

### Per-app toggle pills (`packages/renderer/src/App.tsx:192`, `App.tsx:891`)
- **Purpose**: Enable/disable Cursor/Claude/Codex individually per server.
- **Key visuals**:
  ```ts
  const appToggleStyles = {
    on: 'border-success/70 bg-success/10 text-success dark:text-success',
    off: 'border-border bg-muted text-muted-foreground'
  };
  ```
  Buttons add `flex min-w-[130px] flex-col rounded-md border px-4 py-3 text-left text-xs uppercase tracking-[0.18em]`.
- **Usage**: Server list rows (App) and again inside ServerModal (`ServerModal.tsx:418`).
- **Notes**: ✅ Unified to semantic `success` token across both App and ServerModal.

### Server enable toggle in modal (`packages/renderer/src/components/ServerModal.tsx:395`)
- **Purpose**: Lets users enable/disable a server while editing.
- **Key visuals**: Custom pill `rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em]` with success or muted colors.
- **Usage**: Inside the modal's "Enabled" card.
- **Notes**: ✅ Updated to use semantic `success` token; can be replaced with shadcn Switch component in Phase 2.

### Keychain env alias rows (`packages/renderer/src/components/ServerModal.tsx:452`)
- **Purpose**: Manage Keychain-backed env names, aliases, and secrets.
- **Key visuals**: Section wrapper `rounded-3xl border border-border bg-muted/30`, with each row `rounded-2xl border border-border bg-card/90 p-4` and uppercase labels.
- **Usage**: Add/edit server modal.
- **Notes**: ✅ Migrated to semantic theme tokens (`border`, `muted`, `card`).

### Settings detection cards (`packages/renderer/src/App.tsx:948`)
- **Purpose**: Show detection status and resolved config path per agent.
- **Key visuals**: `rounded-lg border border-border/60 bg-muted/60 p-4`, uppercase label, `Badge variant="outline"` for status, monospace path row.
- **Usage**: Settings card’s `<ul>`.
- **Notes**: Detection badge colors come from `detectionStatusStyles`:
  ```ts
  const detectionStatusStyles = {
    detected: 'border-success/60 bg-success/10 text-success dark:text-success',
    missing: 'border-border bg-muted text-muted-foreground'
  };
  ```
  ✅ Migrated to semantic `success` token.

### Sync status card (`packages/renderer/src/App.tsx:998`)
- **Purpose**: Display last sync timestamp/error and provide “Sync Now”.
- **Key visuals**: Card contains a bordered info block, uppercase label, and full-width primary button with uppercase tracking.
- **Usage**: Third section in the App.
- **Notes**: Sync badge is just `variant="outline"` plus text; no dedicated color tokens for run/error states yet.

### Update check card (`packages/renderer/src/App.tsx:1022`)
- **Purpose**: Manual update checks and auto-check toggle.
- **Key visuals**: Three stat cards inside a grid, status badge using `updateStateStyles`, outline “Check for updates” button, and a custom `role="switch"` button with emerald/muted colors.
- **Usage**: Final section in App.
- **Notes**: `updateStateStyles` defines labels + tint strings:
  ```ts
  const updateStateStyles = {
    idle: { label: 'Idle', className: 'border-border text-muted-foreground' },
    checking: { label: 'Checking…', className: 'border-warning/70 text-warning dark:text-warning' },
    up_to_date: { label: 'Up to date', className: 'border-success/70 text-success dark:text-success' },
    update_available: { label: 'Update available', className: 'border-warning/70 text-warning dark:text-warning' },
    offline: { label: 'Offline', className: 'border-border text-muted-foreground' },
    error: { label: 'Error', className: 'border-destructive/70 text-destructive dark:text-destructive' }
  };
  ```
  ✅ Migrated to semantic tokens (`success`, `warning`, `destructive`).

### Server modal overlay & header (`packages/renderer/src/components/ServerModal.tsx:348`)
- **Purpose**: Full-screen dialog for add/edit flows.
- **Key visuals**: Overlay `fixed inset-0 z-50 overflow-y-auto bg-background/80 ... backdrop-blur-sm`, inner container `rounded-xl border border-border bg-card p-6` with a header using uppercase primary text and `Button variant="ghost"` cancel.
- **Usage**: Triggered by Add/Edit buttons via `modalState`.
- **Notes**: ✅ Updated to use semantic `text-primary` token; maintains consistent styling with dashboard.

### Modal form structure (`packages/renderer/src/components/ServerModal.tsx:366`)
- **Purpose**: Collect server name, command, args, per-app scopes, env aliases, and actions.
- **Key visuals**: Sections separated by rounded borders, uppercase labels (`text-[0.7rem] uppercase tracking-[0.25em] text-muted-foreground`), and consistent spacing (`space-y-2` / `gap-4`).
- **Usage**: Entire modal form.
- **Notes**: Uppercase label style repeats everywhere but is defined inline; extracting a typography helper would reduce duplication.

### Modal error + action bar (`packages/renderer/src/components/ServerModal.tsx:516`)
- **Purpose**: Surface submission errors and provide Cancel/Save CTAs.
- **Key visuals**: Error box `rounded-2xl border border-destructive/40 bg-destructive/10`, action bar `flex justify-end gap-3` with outline cancel and default save button.
- **Usage**: Bottom of the modal form.
- **Notes**: ✅ Migrated to semantic `destructive` token; consistent with other error states.

---

## 🔄 Phase 2: Component Standardization (Next Steps)

### Typography Helpers Needed
- Extract repeated uppercase label style: `text-[0.7rem] uppercase tracking-[0.25em] text-muted-foreground`
- Create reusable Label components with proper variants
- Consolidate header text styles

### Toggle Component Migration
- Replace all custom toggle pills with shadcn `Switch` component
- Master switch, per-app toggles, and server enable toggle need Switch implementation
- Maintain current styling but use consistent component API

### Status Badge Consolidation
- All status indicators now use enhanced Badge variants
- Detection, sync, and update states use `success`, `warning`, `error` variants
- Consider extracting StatusBadge component for common patterns

## Still Unused After Phase 1
- `DropdownMenu` component (`packages/renderer/src/components/ui/dropdown-menu.tsx:1`) is never imported. Removing it would also let us drop the `tw-animate-css` dependency unless future tasks require a menu.
- Custom utilities `container`, `no-scrollbar`, `faded-bottom`, and `.CollapsibleContent` in `styles.css:88-136` are not referenced. Verify before deleting.
- Button variants (`destructive`, `secondary`, `link`) and `lg` size are unused.

### Technical Notes
- Scrollbar behavior depends on `useScrollDetection` scanning `[data-section]` elements; any new scroll container must follow that pattern or the scrollbar will stay invisible.
- All color decisions now use semantic tokens; theme switching works consistently across all components.

Use this inventory as the reference when consolidating components, extracting tokens, or deleting unused styles.
