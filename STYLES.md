# Relay UI — Complete Style Guide

This document captures the complete UI component system for Relay, a macOS-only Electron application that serves as an offline-first MCP (Model Context Protocol) orchestrator.

## Design System Overview

### Core Principles
- **macOS-first**: Native-feeling desktop application with proper window chrome
- **Dark-first theme**: Seamless light/dark/system theme support via CSS custom properties
- **shadcn/ui compliance**: Full adherence to the shadcn/ui component system
- **Semantic tokens**: All colors use theme tokens, never raw Tailwind values
- **Offline-first**: All functionality works without network connectivity

## Theme System

### Color Tokens (`packages/renderer/src/theme.css`)
```css
/* Semantic color palette */
--background: 0 0% 100%;           /* Main app background */
--foreground: 0 0% 3.9%;           /* Primary text */
--card: 0 0% 100%;                /* Card/surface backgrounds */
--border: 0 0% 89.8%;             /* Borders and dividers */
--muted: 0 0% 96.1%;              /* Secondary surfaces */
--accent: 0 0% 96.1%;             /* Interactive highlights */
--primary: 0 0% 9%;               /* Primary brand color */
--destructive: 0 84.2% 60.2%;     /* Error states */
--success: 142 76% 36%;           /* Success states */
--warning: 38 92% 50%;            /* Warning states */
```

### Typography System
Uses shadcn/ui Typography component with standardized variants:
- `h1`-`h4`: Heading sizes with proper tracking and weight
- `body`: Standard body text
- `small`: Secondary text
- `label`: Uppercase form labels (`text-xs uppercase tracking-[0.25em]`)
- `eyebrow`: Section headers (`text-xs font-semibold uppercase tracking-[0.3em]`)

## Component Library

### shadcn/ui Components Available

#### Interactive Elements
- **Button**: All variants (`default`, `outline`, `ghost`, `secondary`, `destructive`, `icon`, `sm`, `lg`)
- **Switch**: Radix-based toggle component for enable/disable functionality
- **Input**: Form input fields with proper focus states
- **Textarea**: Multi-line text input with field sizing
- **Label**: Enhanced with `uppercase` variant for form field labels

#### Layout & Display
- **Card**: Standard container with header variants (`CardHeader`, `CardTitle`, `CardDescription`, `CardContent`)
- **Separator**: Visual dividers for layouts
- **Badge**: Status indicators with semantic variants (`success`, `warning`, `error`, `muted`, `outline`)

#### Feedback & Communication
- **Alert**: Success/warning/error variants with proper semantic tokens
- **Progress**: Radix-based progress indicators

#### Specialized Components
- **Typography**: Comprehensive typography system with variants and color controls
- **ModeToggle**: Theme switcher in the header

## Layout Patterns

### App Shell (`packages/renderer/src/App.tsx:1092`)
```tsx
<main className="relative flex min-h-screen bg-background font-sans text-foreground antialiased">
  {/* Drag strip for macOS window management */}
  <div className="fixed left-0 right-0 top-0 z-50 h-6" style={{ WebkitAppRegion: 'drag' }} />

  {/* Two-column layout */}
  <Sidebar />
  <ContentArea className="md:ml-[240px]" />
</main>
```

### Sidebar Navigation
- Fixed sidebar with icon + text navigation
- Active state uses `bg-accent text-accent-foreground`
- Desktop-only layout (`hidden md:flex`)

### Header Hero Pattern
```tsx
<header>
  <Typography variant="eyebrow" color="primary">Product category</Typography>
  <Typography variant="h1">Product name</Typography>
  <Typography variant="body" color="muted">Product description</Typography>
  <ModeToggle />
</header>
```

### Section Cards
```tsx
<Card>
  <CardHeader>
    <CardTitle>Section Title</CardTitle>
    <CardDescription>Section description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Section content */}
  </CardContent>
</Card>
```

## Interactive Patterns

### Toggle Controls
All toggle functionality uses shadcn Switch component:

#### Server Enable Toggle
```tsx
<div className="flex items-center justify-between">
  <div>
    <Typography variant="label" color="muted">Enabled</Typography>
    <Typography variant="small">Description text</Typography>
  </div>
  <Switch
    checked={enabled}
    onCheckedChange={handleChange}
  />
</div>
```

#### Per-App Scope Toggles
```tsx
<div className="grid gap-3 sm:grid-cols-3">
  {agents.map((agent) => (
    <div key={agent} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
      <div className="flex-1">
        <Typography variant="eyebrow" color="muted">{agent}</Typography>
        <Typography variant="small">{status}</Typography>
      </div>
      <Switch checked={enabled} onCheckedChange={handleToggle} disabled={!detected} />
    </div>
  ))}
</div>
```

### Status Indicators

#### Badge Variants
```tsx
{/* Status badges */}
<Badge variant="success">Connected</Badge>
<Badge variant="warning">Updating</Badge>
<Badge variant="error">Error</Badge>
<Badge variant="muted">Offline</Badge>
<Badge variant="outline">Default</Badge>
```

#### Alert Component
```tsx
<Alert variant="destructive">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Error message with details.</AlertDescription>
</Alert>

<Alert variant="success">
  <AlertTitle>Success</AlertTitle>
  <AlertDescription>Operation completed successfully.</AlertDescription>
</Alert>
```

## Form Patterns

### Standard Form Layout
```tsx
<form className="flex flex-col gap-6">
  <div className="space-y-2">
    <Label variant="uppercase">Field Name</Label>
    <Input placeholder="Placeholder text" />
    {error && <Typography variant="small" color="destructive">{error}</Typography>}
  </div>

  <div className="grid gap-4 md:grid-cols-2">
    <div className="space-y-2">
      <Label variant="uppercase">Field 1</Label>
      <Input />
    </div>
    <div className="space-y-2">
      <Label variant="uppercase">Field 2</Label>
      <Textarea />
    </div>
  </div>
</form>
```

### Modal Structure
```tsx
<div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-sm">
  <div className="mx-auto flex min-h-full w-full max-w-4xl items-start justify-center p-4">
    <div className="relative w-full rounded-xl border border-border bg-card p-6">
      <header className="flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Typography variant="eyebrow" color="primary">Modal Type</Typography>
          <Typography variant="h2">Modal Title</Typography>
        </div>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </header>

      {/* Modal content */}
    </div>
  </div>
</div>
```

## Responsive Design

### Breakpoints
- Mobile: Default styles
- Tablet: `md:` prefix (768px+)
- Desktop: Full layout with sidebar

### Patterns
- **Mobile-first**: Base styles target mobile, enhanced for desktop
- **Responsive grids**: Use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- **Flexible layouts**: `flex-col sm:flex-row` for horizontal stacking on larger screens

## Accessibility

### Standards
- **ARIA attributes**: All interactive elements have proper ARIA labels
- **Keyboard navigation**: Full keyboard accessibility via Radix UI primitives
- **Focus management**: Visible focus states (`focus-visible:ring-2 focus-visible:ring-ring`)
- **Screen reader support**: Semantic HTML and proper labeling

### Patterns
```tsx
{/* Proper form labeling */}
<Label htmlFor="field-id">Field Name</Label>
<Input id="field-id" />

{/* Toggle with proper state */}
<Switch checked={enabled} aria-label="Enable feature" />

{/* Status announcements */}
<Badge aria-label={`Status: ${status}`}>{status}</Badge>
```

## Animation & Transitions

### Standard Transitions
- **Color transitions**: `transition-colors`
- **Transform transitions**: `transition-transform`
- **Duration**: `duration-200` for standard, `duration-300` for complex animations

### Component States
```tsx
{/* Hover states */}
<Button className="hover:bg-primary/90 transition-colors">

{/* Focus states */}
<Input className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">

{/* Loading states */}
<Switch disabled className="opacity-50">
```

## Color Usage Guidelines

### Semantic Color Mapping
- **Success**: Connected, enabled, successful operations
- **Warning**: In-progress, updating, attention needed
- **Destructive**: Errors, failed operations, destructive actions
- **Muted**: Disabled, inactive, secondary information
- **Primary**: Brand actions, primary interactive elements

### Dark Mode Support
All colors automatically adapt via CSS custom properties:
- Light mode uses lighter values
- Dark mode uses darker, higher contrast values
- System theme respects user preferences

## Development Guidelines

### Component Usage
1. **Always prefer shadcn components** over custom implementations
2. **Use semantic tokens**, never raw colors (`text-red-500` → `text-destructive`)
3. **Leverage Typography component** for consistent text styling
4. **Maintain proper accessibility** with ARIA labels and keyboard navigation

### Code Patterns
```tsx
// ✅ Good: Use semantic tokens and components
<Typography variant="label" color="muted">Field Label</Typography>
<Input className="border-input" />

// ❌ Avoid: Raw colors and custom styling
<p className="text-gray-500 uppercase">Label</p>
<input className="border-gray-300" />
```

### Testing
- **Visual regression**: Test all theme variants (light/dark/system)
- **Accessibility**: Verify keyboard navigation and screen reader compatibility
- **Responsive**: Test on mobile, tablet, and desktop breakpoints
- **Component states**: Test all variants (default, hover, focus, disabled)

## File Organization

```
packages/renderer/src/
├── components/
│   ├── ui/                    # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── switch.tsx
│   │   ├── typography.tsx
│   │   └── ...
│   ├── mode-toggle.tsx       # Theme switcher
│   └── ServerModal.tsx       # Main modal component
├── theme.css                 # Color tokens and theme definitions
├── styles.css               # Global styles and base layer
└── App.tsx                  # Main application layout
```

## Advanced Features

### Loading States
- **Skeleton components**: Consistent loading placeholders with `Skeleton` component
- **LoadingSpinner**: Standardized loading indicator with size variants
- **Progressive enhancement**: Content loads gracefully with proper fallbacks

```tsx
{loading ? (
  <div className="space-y-4">
    <div className="flex items-center gap-2">
      <LoadingSpinner size="sm" />
      <Typography variant="small" color="muted">Loading...</Typography>
    </div>
    {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-16 w-full rounded-lg" />
    ))}
  </div>
) : (
  <Content />
)}
```

### Error Handling
- **ErrorBoundary**: Catch and gracefully handle component errors
- **Fallback UI**: Default and custom error states with recovery options
- **Status alerts**: Consistent error messaging with Alert component

```tsx
<ErrorBoundary fallback={({ error, reset }) => (
  <Alert variant="destructive">
    <AlertTitle>Something went wrong</AlertTitle>
    <AlertDescription>{error.message}</AlertDescription>
    <Button onClick={reset} variant="outline" size="sm">Try again</Button>
  </Alert>
)}>
  <Component />
</ErrorBoundary>
```

### Accessibility Enhancements
- **Focus management**: FocusTrap for modals and keyboard navigation
- **Screen reader support**: Proper ARIA labels and live regions
- **Keyboard shortcuts**: Escape to close modals, Ctrl/Cmd+K for quick actions
- **Reduced motion**: Respects `prefers-reduced-motion` media queries

### Motion & Animations
- **Smooth transitions**: Custom easing functions for natural motion
- **Micro-interactions**: Hover effects, active states, and focus animations
- **Staggered animations**: Sequential element reveals for polished UX
- **Performance optimized**: GPU-accelerated transforms with `will-change`

```tsx
<div className="animate-scale-in transition-all-300 hover-lift">
  Content with smooth animations
</div>
```

### Component Composition
- **FormField**: Composed label/input/error patterns
- **StatusCard**: Consistent status display with actions
- **ErrorBoundary**: Wrapper for error-safe sections
- **Typography**: Unified text styling system

### Performance Optimizations
- **Lazy error boundaries**: Section-by-section error isolation
- **Optimized animations**: CSS transforms over layout changes
- **Memory management**: Proper cleanup in useEffect hooks
- **Bundle efficiency**: Tree-shakable component exports

### Keyboard Navigation
- **Escape handling**: Close modals and cancel operations
- **Quick actions**: Ctrl/Cmd+K for common operations
- **Tab order**: Logical focus progression through interactive elements
- **Focus trapping**: Keep focus within modal dialogs

## Development Workflow

### Component Creation
1. **Use existing patterns** before creating new components
2. **Follow accessibility guidelines** with proper ARIA attributes
3. **Include error boundaries** for robust error handling
4. **Add motion classes** for smooth interactions
5. **Document props** with TypeScript interfaces

### Code Quality Standards
```tsx
// ✅ Recommended pattern
<ErrorBoundary>
  <FormField
    label="Server Name"
    description="Enter a descriptive name for your MCP server"
    error={errors.name}
    required
  >
    <Input
      value={state.name}
      onChange={(e) => updateField('name', e.target.value)}
      placeholder="Workspace Relay"
      className="transition-all-300"
    />
  </FormField>
</ErrorBoundary>
```

### Testing Checklist
- **Accessibility**: Test keyboard navigation and screen reader compatibility
- **Error scenarios**: Verify error boundaries catch and display appropriately
- **Performance**: Check animations are smooth and respect reduced motion
- **Responsive**: Test on all supported viewport sizes
- **Interactions**: Verify hover, focus, and active states work correctly

## File Organization (Updated)

```
packages/renderer/src/
├── components/
│   ├── ui/                           # shadcn/ui + custom components
│   │   ├── alert.tsx                 # Enhanced with success/warning/error
│   │   ├── button.tsx                # Enhanced with smooth animations
│   │   ├── card.tsx                  # shadcn/ui base component
│   │   ├── error-boundary.tsx        # Error handling wrapper
│   │   ├── focus-trap.tsx            # Focus management
│   │   ├── form-field.tsx            # Composed form patterns
│   │   ├── index.ts                  # Component exports and types
│   │   ├── loading-spinner.tsx       # Loading indicators
│   │   ├── skeleton.tsx              # Loading placeholders
│   │   ├── status-card.tsx           # Status display component
│   │   ├── switch.tsx                # Toggle component
│   │   ├── typography.tsx            # Text styling system
│   │   └── ...                      # Other shadcn/ui components
│   ├── mode-toggle.tsx               # Theme switcher
│   └── ServerModal.tsx               # Enhanced modal with focus trap
├── theme.css                         # Color tokens and theme system
├── styles.css                        # Global styles and base layer
├── motion.css                        # Animation and motion definitions
└── App.tsx                           # Main app with keyboard shortcuts
```

This comprehensive style guide includes all Phase 3 enhancements, ensuring Relay provides a professional, accessible, and delightful user experience while maintaining excellent performance and developer experience.