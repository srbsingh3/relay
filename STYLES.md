# Relay UI Style Inventory

This document catalogs all UI components, style definitions, and visual patterns used across the Relay application. It serves as a reference for understanding the current design system and identifying opportunities for cleanup, standardization, and future redesign.

## Table of Contents

1. [Design System Foundation](#design-system-foundation)
2. [UI Components](#ui-components)
3. [Layout Patterns](#layout-patterns)
4. [Animation & Motion](#animation--motion)
5. [Utility Classes](#utility-classes)
6. [Unused & Potentially Redundant Styles](#unused--potentially-redundant-styles)
7. [File Organization](#file-organization)

---

## Design System Foundation

### Theme System (`packages/renderer/src/theme.css`)

**Purpose**: Central design token system for consistent theming across light/dark/System modes.

**Key Visual Characteristics**:
- HSL-based color tokens for predictable theming
- Semantic color naming (primary, destructive, success, warning)
- Complete dual-theme support with high contrast ratios

**Color Tokens**:
```css
/* Core semantic colors */
--background: 0 0% 100%; / * Main app background * /
--foreground: 0 0% 3.9%;   / * Primary text * /
--card: 0 0% 100%;        / * Card surfaces * /
--border: 0 0% 89.8%;     / * Borders & dividers * /
--muted: 0 0% 96.1%;      / * Secondary surfaces * /

/* Interactive colors */
--primary: 0 0% 9%;       / * Brand primary * /
--destructive: 0 84.2% 60.2%; / * Error states * /
--success: 142 76% 36%;    / * Success states * /
--warning: 38 92% 50%;     / * Warning states * /

/* Sidebar-specific tokens */
--sidebar: var(--background);
--sidebar-foreground: var(--foreground);
--sidebar-primary: var(--primary);
```

**Dark Mode Overrides**:
```css
.dark {
  --background: 0 0% 3.9%;    / * Inverted background * /
  --foreground: 0 0% 98%;      / * Inverted text * /
  --success: 142 70% 45%;      / * Adjusted success hue * /
  --warning: 38 84% 56%;       / * Adjusted warning hue * /
}
```

**Typography System** (`packages/renderer/src/components/ui/typography.tsx`):
- **Font Stack**: Inter & Manrope as primary sans-serif fonts
- **Size Scale**: Text sizes from `h4` to `h1` with consistent tracking
- **Semantic Variants**: `label` (uppercase forms), `eyebrow` (headers), `body` (content)

**Used In**: All components for consistent text styling

### Global Styles (`packages/renderer/src/styles.css`)

**Purpose**: Base layer styles, scrollbar behavior, and cross-browser normalization.

**Key Features**:
- **Custom Scrollbar**: Invisible by default, appears on scroll with smooth fade
- **Base Typography**: `font-sans antialiased` for smooth text rendering
- **Button Cursor**: Ensures pointer cursor for interactive elements
- **Mobile Input Scaling**: Prevents zoom on iOS with `font-size: 16px !important`

**Scrollbar Implementation**:
```css
&::-webkit-scrollbar-thumb {
  background-color: transparent;
  opacity: 0;
  transition: opacity 150ms ease;
}

/* Show only when scrolling */
html.scrolling &::-webkit-scrollbar-thumb,
&.scrolling::-webkit-scrollbar-thumb {
  background-color: var(--border);
  opacity: 1;
}
```

**Used In**: Global application styles via `App.tsx:2`

---

## UI Components

### 1. Button (`packages/renderer/src/components/ui/button.tsx`)

**Purpose**: Primary interactive element for actions and navigation.

**Key Visual Characteristics**:
- **Rounded corners**: `rounded-md` (0.375rem border radius)
- **Base typography**: `text-sm font-medium`
- **Enhanced animations**: `transition-all-300`, `hover-lift`, `active:scale-95`
- **Focus management**: Ring focus with proper contrast

**Variant System**:
```typescript
variant: {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'text-foreground hover:bg-muted',
  link: 'text-primary underline-offset-4 hover:underline'
}
size: {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md gap-1.5 px-3 text-xs',
  lg: 'h-11 rounded-md px-6 text-base',
  icon: 'size-10 rounded-md justify-center'
}
```

**Usage Locations**:
- **App.tsx**: Server actions, navigation buttons, form submissions
- **ServerModal.tsx**: Save/Cancel buttons, form actions
- **StatusCard.tsx**: Action buttons in status displays

### 2. Card (`packages/renderer/src/components/ui/card.tsx`)

**Purpose**: Container component for grouping related content with subtle visual hierarchy.

**Key Visual Characteristics**:
- **Subtle borders**: `border-border` with low opacity
- **Background color**: Uses theme token system
- **Flexible padding**: Configurable via props
- **Clean typography**: Consistent with design system

**Structure**:
```typescript
<Card> // Main container with border and background
  <CardHeader> // Optional header with title/description
    <CardTitle> // Large, bold text
    <CardDescription> // Secondary, muted text
  </CardHeader>
  <CardContent> // Main content area
```

**Usage Locations**:
- **App.tsx**: Main content sections (servers, settings, sync, updates)
- **StatusCard.tsx**: Base component for status displays

### 3. Badge (`packages/renderer/src/components/ui/badge.tsx`)

**Purpose**: Small status indicators and categorical labels.

**Key Visual Characteristics**:
- **Small size**: `text-xs font-semibold` with tight spacing
- **Rounded shape**: `rounded-md` with `px-2.5 py-0.5`
- **Semantic colors**: Success, warning, error, muted variants
- **Focus management**: Ring focus with appropriate contrast

**Comprehensive Variants**:
```typescript
variant: {
  default: 'border-transparent bg-primary text-primary-foreground',
  success: 'border-success/60 bg-success/10 text-success',
  warning: 'border-warning/60 bg-warning/10 text-warning',
  error: 'border-destructive/60 bg-destructive/10 text-destructive',
  muted: 'border-border bg-muted text-muted-foreground',
  outline: 'border-input/70 text-foreground'
}
```

**Usage Locations**:
- **App.tsx**: Server states, detection status, sync status, update status
- **StatusCard.tsx**: Primary status indicator in header

### 4. Switch (`packages/renderer/src/components/ui/switch.tsx`)

**Purpose**: Binary toggle control for enable/disable functionality.

**Key Visual Characteristics**:
- **Smooth animations**: Color transitions with proper easing
- **Accessible**: Full keyboard navigation and ARIA support
- **Radix-powered**: Robust accessibility primitives
- **Theme-aware**: Adapts colors to dark/light themes

**Visual Design**:
```css
data-[state=checked]:bg-primary / * Active state * /
data-[state=unchecked]:bg-input / * Inactive state * /
hover:border-ring /70 / * Interactive hover * /
```

**Usage Locations**:
- **App.tsx**: Per-app toggle switches, master server toggle
- **ServerModal.tsx**: Server enable toggle, per-app scope toggles

### 5. Input (`packages/renderer/src/components/ui/input.tsx`)

**Purpose**: Form input fields with consistent styling and validation states.

**Key Visual Characteristics**:
- **Standard sizing**: `h-10 w-full` with consistent padding
- **Subtle borders**: `border-input` with focus management
- **Validation states**: Error ring styling
- **Placeholder text**: Muted color with good contrast

**Focus Management**:
```css
focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
aria-invalid:ring-destructive/20 aria-invalid:border-destructive
```

**Usage Locations**:
- **ServerModal.tsx**: Server name, command, environment variable inputs

### 6. Typography (`packages/renderer/src/components/ui/typography.tsx`)

**Purpose**: Unified text styling system for consistent typography across the application.

**Key Visual Characteristics**:
- **Semantic variants**: Clear hierarchy from `h1` to `small`
- **Color control**: Consistent color application via props
- **Tracking presets**: Optimized letter spacing for readability
- **Flexible rendering**: Can render any HTML element

**Variant System**:
```typescript
variant: {
  h1: 'text-3xl font-bold tracking-tight',
  h2: 'text-2xl font-semibold tracking-tight',
  h3: 'text-xl font-semibold tracking-tight',
  h4: 'text-lg font-semibold tracking-tight',
  body: 'text-base',
  small: 'text-sm',
  label: 'text-xs uppercase tracking-[0.25em] font-medium',
  eyebrow: 'text-xs font-semibold uppercase tracking-[0.3em]'
}
```

**Usage Locations**:
- **App.tsx**: Section headers, content text, status messages
- **ServerModal.tsx**: Form labels, descriptions, status text
- **StatusCard.tsx**: Card headers and descriptions

### 7. Modal System (`ServerModal.tsx` + FocusTrap)

**Purpose**: Overlays for forms and detailed interactions with proper accessibility.

**Key Visual Characteristics**:
- **Backdrop blur**: `bg-background/80 backdrop-blur-sm`
- **Scale animation**: `animate-scale-in` with smooth easing
- **Focus trapping**: Keyboard navigation contained within modal
- **Responsive design**: Mobile and desktop optimized

**Modal Structure**:
```tsx
<div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-sm modal-backdrop">
  <div className="mx-auto flex min-h-full w-full max-w-4xl items-start justify-center">
    <FocusTrap active>
      <div className="relative w-full rounded-xl border border-border bg-card p-6 modal-content animate-scale-in">
        {/* Modal content */}
      </div>
    </FocusTrap>
  </div>
</div>
```

**Accessibility Features**:
- **ARIA attributes**: `aria-modal="true"`, `aria-labelledby`
- **Keyboard support**: Escape key closes, Tab navigation trapped
- **Focus management**: Returns focus to trigger element on close

**Usage Locations**:
- **App.tsx**: Server add/edit modals

---

## Layout Patterns

### 1. Application Shell (`App.tsx` lines 1141-1210)

**Purpose**: Main application layout with sidebar navigation and content area.

**Key Visual Characteristics**:
- **Two-column layout**: Fixed sidebar + scrolling content
- **Drag handle**: macOS window management support
- **Responsive behavior**: Sidebar hidden on mobile, visible on desktop
- **Visual hierarchy**: Clear separation between navigation and content

**Layout Structure**:
```tsx
<main className="relative flex min-h-screen bg-background font-sans text-foreground antialiased">
  {/* macOS drag handle */}
  <div className="fixed left-0 right-0 top-0 z-50 h-6" style={{ WebkitAppRegion: 'drag' }} />

  {/* Sidebar */}
  <aside className="fixed left-0 top-0 bottom-0 w-[240px] hidden md:flex">
    {/* Navigation */}
  </aside>

  {/* Content area */}
  <div className="relative min-h-screen bg-background md:ml-[240px]">
    {/* Main content */}
  </div>
</main>
```

### 2. Sidebar Navigation (`App.tsx` lines 1150-1182)

**Purpose**: Primary navigation for application sections.

**Key Visual Characteristics**:
- **Fixed width**: `w-[240px]` with consistent spacing
- **Brand section**: Logo + app name with visual hierarchy
- **Navigation items**: Icon + text with active state styling
- **Vertical spacing**: Consistent gap system

**Navigation Pattern**:
```tsx
<nav className="mt-8 flex-1 flex flex-col gap-2">
  {SIDEBAR_SECTIONS.map((section) => (
    <button className={cn(
      'group flex items-center gap-3 rounded-lg px-3 py-2',
      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'
    )}>
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
        {section.icon}
      </span>
      <span>{section.label}</span>
    </button>
  ))}
</nav>
```

### 3. Content Cards (`App.tsx` sections)

**Purpose**: Grouped content areas for each application section.

**Visual Pattern**:
```tsx
<Card className="p-6" aria-labelledby="{section}-heading">
  <CardHeader className="flex items-start justify-between gap-4">
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.24em] text-primary/70">{section}</p>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </div>
    <Badge variant={statusVariant}>{status}</Badge>
  </CardHeader>
  <CardContent>
    {/* Section content */}
  </CardContent>
</Card>
```

**Used For**: Servers, Settings, Sync, Updates sections

### 4. Server List Pattern (`App.tsx` lines 867-875)

**Purpose**: Display server configurations with actions and status.

**Key Visual Characteristics**:
- **Card-based**: Each server in its own card with `border-border bg-card`
- **Responsive layout**: Stacked on mobile, side-by-side on desktop
- **Interactive elements**: Delete button, enable toggle
- **Code display**: Monospace font for command display

**Server Card Structure**:
```tsx
<li className="rounded-lg border border-border bg-card p-5">
  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
    <div>
      <p className="text-lg font-semibold text-foreground">{server.name}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        <code className="rounded-md bg-muted/60 px-3 py-1 font-mono text-sm text-foreground">
          {formatCommand(server)}
        </code>
      </p>
    </div>
    {/* Actions */}
  </div>
</li>
```

### 5. Loading State Pattern (`App.tsx` lines 833-841)

**Purpose**: Skeleton loading with realistic content structure.

**Key Visual Characteristics**:
- **Animated placeholders**: `animate-pulse` with `bg-muted`
- **Realistic proportions**: Matches actual content layout
- **Multiple states**: Header, content, and toggle skeletons
- **Smooth transitions**: Loading spinner + skeleton combo

**Skeleton Structure**:
```tsx
<div className="rounded-lg border border-border bg-card p-5 space-y-3">
  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
    <div className="space-y-2">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-6 w-64" />
    </div>
    <div className="flex gap-2">
      <Skeleton className="h-8 w-16 rounded-md" />
    </div>
  </div>
</div>
```

---

## Animation & Motion

### Motion System (`packages/renderer/src/motion.css`)

**Purpose**: Comprehensive animation library for smooth, consistent interactions.

**Key Animations**:

#### 1. Entry Animations
```css
.animate-slide-in-right: { transform: translateX(100%) → translateX(0), opacity: 0 → 1 }
.animate-slide-in-up: { transform: translateY(20px) → translateY(0), opacity: 0 → 1 }
.animate-fade-in: { opacity: 0 → 1 }
.animate-scale-in: { transform: scale(0.95) → scale(1), opacity: 0 → 1 }
```

#### 2. Interactive Transitions
```css
.transition-all-300: { all 300ms cubic-bezier(0.4, 0, 0.2, 1) }
.transition-colors-300: { color, background-color, border-color 300ms }
.hover-lift:hover: { translateY(-2px) + box-shadow }
.active:scale-95: { scale(0.95) on active state }
```

#### 3. Modal Animations
```css
.modal-backdrop: { fadeIn 0.2s ease-out }
.modal-content: { scaleIn 0.2s ease-out }
```

#### 4. Loading Animations
```css
.loading-dots::after: { '' → '.' → '..' → '...' 1.5s infinite }
.animate-pulse-slow: { opacity 1 → 0.5 → 1 2s infinite }
```

**Accessibility**:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Usage Locations**:
- **Button**: `transition-all-300`, `hover-lift`, `active:scale-95`
- **Modal**: `modal-backdrop`, `modal-content` classes
- **Loading states**: Skeleton components with `animate-pulse`
- **Interactions**: Smooth color and transform transitions

---

## Utility Classes

### 1. Spacing & Layout

**Common Patterns**:
```tsx
// Container spacing
space-y-4: { margin-top: 1rem between children }
gap-3: { gap: 0.75rem between grid/flex items }

// Card padding
p-5: { padding: 1.25rem }
px-4 py-2: { horizontal: 1rem, vertical: 0.5rem }

// Responsive behavior
md:flex-row md:items-start md:justify-between
```

### 2. Typography Utilities

**Text Sizes**:
```tsx
text-xs: { 0.75rem }   // Labels, badges
text-sm: { 0.875rem }  // Secondary text
text-base: { 1rem }   // Body text
text-lg: { 1.125rem }  // Large text
text-xl: { 1.25rem }   // Section headers
text-2xl: { 1.5rem }  // Page headers
text-3xl: { 1.875rem } // Hero text
text-4xl: { 2.25rem }  // Large headers
```

**Font Weights**:
```tsx
font-medium: { 500 }  // Standard weight
font-semibold: { 600 } // Emphasis
font-bold: { 700 }    // Strong emphasis
```

**Letter Spacing**:
```tsx
tracking-[0.18em]:  // Standard uppercase
tracking-[0.2em]:   // Form labels
tracking-[0.24em]:  // Section headers
tracking-[0.3em]:   // Eyebrow text
tracking-tight:      // Headings
```

### 3. Color & State Utilities

**Semantic Colors**:
```tsx
text-primary / { --color-primary }
text-muted-foreground / { --color-muted-foreground }
text-destructive / { --color-destructive }
text-success / { --color-success }
text-warning / { --color-warning }

bg-primary / { --color-primary }
bg-muted / { --color-muted }
bg-card / { --color-card }
```

**State Indicators**:
```tsx
opacity-50: // Disabled/low-priority elements
ring-2 ring-ring ring-offset-2: // Focus states
border-border: // Standard borders
border-border/60: // Subtle borders
```

### 4. Custom Utilities (from motion.css)

**Animation Classes**:
```tsx
transition-all-300: { all 300ms cubic-bezier(0.4, 0, 0.2, 1) }
hover-lift: { translateY(-2px) + box-shadow on hover }
animate-scale-in: { scale 0.95 → 1, opacity 0 → 1 }
modal-backdrop: { fadeIn 0.2s ease-out }
```

---

## Unused & Potentially Redundant Styles

### 1. Chart Color Tokens (`theme.css` lines 26-30, 65-69)

**Purpose**: Defined but not actively used in current UI.

**Tokens**:
```css
--chart-1: 12 76% 61%;
--chart-2: 173 58% 39%;
--chart-3: 197 37% 24%;
--chart-4: 43 74% 66%;
--chart-5: 27 87% 67%;
```

**Status**: ✅ **Safe to remove** - No chart components currently implemented

### 2. DropdownMenu Component (`packages/renderer/src/components/ui/dropdown-menu.tsx`)

**Purpose**: shadcn/ui dropdown component included but not used.

**Usage**: ❌ **Not imported or used anywhere in the codebase**

**Cleanup Impact**:
- Can remove `@radix-ui/react-dropdown-menu` dependency
- Remove component file entirely
- Update component index exports

### 3. Certain Button Variants

**Partially Used Variants**:
- **`destructive`**: Used only in error states
- **`secondary`**: Limited usage, could be consolidated
- **`link`**: Not used in current design

**Recommendation**: Review usage patterns and potentially consolidate

### 4. Unused Custom CSS Utilities

**Previous utilities removed in styles.css cleanup**:
- ~~`@utility container`~~ - Not used
- ~~`@utility no-scrollbar`~~ - Replaced with scroll detection
- ~~`@utility faded-bottom`~~ - Not implemented

**Status**: ✅ **Already cleaned up** in previous refactoring

### 5. Form Field Label Patterns

**Inconsistent Implementation**:
```tsx
// Pattern 1 - Direct labels
<Label variant="uppercase">Field Name</Label>

// Pattern 2 - Typography components
<Typography variant="label" color="muted">Field Name</Typography>
```

**Status**: ⚠️ **Needs standardization** - Multiple approaches for same visual outcome

### 6. Badge Size Consistency

**Mixed Badge Size Classes**:
```tsx
// Pattern 1 - Default size
<Badge variant="success">Connected</Badge>

// Pattern 2 - Custom sizing
<Badge variant="outline" className="px-3 py-1 text-[0.65rem]">Status</Badge>
```

**Status**: ⚠️ **Inconsistent sizing** - Should standardize or use size variants

### 7. Progress Component (`packages/renderer/src/components/ui/progress.tsx`)

**Purpose**: Radix-based progress indicator component.

**Status**: ❌ **Not used** - Created but not integrated anywhere

**Usage**: Could be useful for sync/upload progress indicators

### 8. StatusCard Component (`packages/renderer/src/components/ui/status-card.tsx`)

**Purpose**: Consistent status display component with actions.

**Status**: ❌ **Not used** - Created but not integrated

**Usage**: Could replace many Card + Badge patterns in App.tsx

---

## File Organization

### Core UI Structure
```
packages/renderer/src/
├── components/
│   ├── ui/                           # shadcn/ui + custom components (24 files)
│   │   ├── alert.tsx                 # ✅ Used - Error/success states
│   │   ├── badge.tsx                 # ✅ Used - Status indicators
│   │   ├── button.tsx                # ✅ Used - All interactive elements
│   │   ├── card.tsx                  # ✅ Used - Content containers
│   │   ├── dropdown-menu.tsx         # ❌ Unused - Can remove
│   │   ├── error-boundary.tsx        # ✅ Used - Error handling
│   │   ├── focus-trap.tsx            # ✅ Used - Modal focus management
│   │   ├── form-field.tsx            # ⚠️ Partially used - Mixed with Label
│   │   ├── index.ts                  # ✅ Used - Component exports
│   │   ├── input.tsx                 # ✅ Used - Form inputs
│   │   ├── label.tsx                 # ✅ Used - Form labels
│   │   ├── loading-spinner.tsx       # ✅ Used - Loading states
│   │   ├── progress.tsx              # ❌ Unused - No progress bars implemented
│   │   ├── separator.tsx             # ✅ Used - Visual dividers
│   │   ├── skeleton.tsx              # ✅ Used - Loading placeholders
│   │   ├── status-card.tsx           # ❌ Unused - Created but not integrated
│   │   ├── switch.tsx                # ✅ Used - Toggle controls
│   │   ├── textarea.tsx              # ✅ Used - Multi-line inputs
│   │   └── typography.tsx            # ✅ Used - Text styling
│   ├── mode-toggle.tsx               # ✅ Used - Theme switcher
│   ├── ServerModal.tsx               # ✅ Used - Main modal
│   └── theme-provider.tsx            # ✅ Used - Theme context
├── theme.css                         # ✅ Used - Design tokens
├── styles.css                        # ✅ Used - Global styles
├── motion.css                        # ✅ Used - Animations
└── App.tsx                           # ✅ Used - Main application
```

### CSS Dependencies
```css
/* Main styles import chain */
@import 'tailwindcss';              // ✅ Core Tailwind
@import 'tw-animate-css';            // ✅ Animation utilities
@import './theme.css';               // ✅ Design tokens
@import './motion.css';              // ✅ Custom animations
```

### Package Dependencies
```json
// UI-related dependencies
"@radix-ui/react-dropdown-menu": "❌ Unused - Remove"
"@radix-ui/react-label": "✅ Used - Form labels"
"@radix-ui/react-progress": "❌ Unused - Remove"
"@radix-ui/react-separator": "✅ Used - Dividers"
"@radix-ui/react-switch": "✅ Used - Toggles"
"focus-trap": "✅ Used - Modal focus management"
"tw-animate-css": "✅ Used - Animations"
```

---

## Cleanup Recommendations

### High Priority (Safe to Remove)
1. **Remove dropdown-menu component** - Not used anywhere
2. **Remove unused Radix dependencies** - `@radix-ui/react-dropdown-menu`, `@radix-ui/react-progress`
3. **Remove chart color tokens** - Not used in current implementation
4. **Clean up badge size inconsistencies** - Standardize sizing approach

### Medium Priority (Needs Investigation)
1. **Standardize form field patterns** - Choose between Label vs Typography
2. **Review button variant usage** - Consolidate unused variants
3. **Audit progress component** - Could be useful for future features
4. **Integrate StatusCard component** - Could simplify many Card patterns

### Low Priority (Keep for Future)
1. **FormField component** - Good pattern, just needs consistent adoption
2. **Extra animation utilities** - Helpful for future enhancements
3. **StatusCard component** - Well-designed, just not integrated yet

---

## Implementation Guidelines

### When Adding New Components:
1. **Check existing patterns** before creating new components
2. **Use semantic color tokens** over hardcoded colors
3. **Include focus management** for interactive elements
4. **Add proper ARIA attributes** for accessibility
5. **Test in both light and dark themes**
6. **Verify reduced motion compliance**

### When Modifying Styles:
1. **Update this document** to reflect changes
2. **Test across all usage locations** to prevent regressions
3. **Consider component variants** before custom classes
4. **Maintain consistent naming conventions**
5. **Preserve accessibility features**

### Migration Path for Unused Components:
1. **Remove component files** from `/components/ui/`
2. **Update index.ts exports** to remove unused imports
3. **Remove package dependencies** from `package.json`
4. **Test build and functionality** after removal
5. **Update documentation** to reflect removal

This style inventory serves as a comprehensive reference for understanding Relay's current design system and planning future UI improvements. Regular updates to this document will help maintain design consistency and identify opportunities for code cleanup and optimization.