import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';
import { ThemeProvider } from './components/theme-provider';

// Helper to render App with required providers
const renderApp = () => {
  return renderToStaticMarkup(
    <ThemeProvider defaultTheme="dark" storageKey="relay-theme">
      <App />
    </ThemeProvider>
  );
};

describe('App layout', () => {
  it('renders the main layout with sidebar and content', () => {
    const html = renderApp();
    expect(html).toContain('Relay');
    expect(html).toContain('MCP Manager');
  });

  it('renders the servers view by default', () => {
    const html = renderApp();
    expect(html).toContain('MCP Servers');
    expect(html).toContain('Add Server');
  });

  it('renders server cards with app toggles', () => {
    const html = renderApp();
    // Should have app toggle buttons
    expect(html).toContain('Cursor');
    expect(html).toContain('Claude');
    expect(html).toContain('Codex');
  });

  it('includes navigation between servers and settings', () => {
    const html = renderApp();
    expect(html).toContain('Servers');
    expect(html).toContain('Settings');
  });

  it('includes theme toggle in sidebar', () => {
    const html = renderApp();
    // Theme toggle should be present
    expect(html).toContain('Light');
    expect(html).toContain('Dark');
    expect(html).toContain('System');
  });
});

describe('Server card features', () => {
  it('displays server name and command', () => {
    const html = renderApp();
    // Fallback servers should be visible
    expect(html).toContain('Context7');
    expect(html).toContain('Filesystem');
    expect(html).toContain('npx');
  });

  it('shows type badge for servers', () => {
    const html = renderApp();
    // Command type badge should be present
    expect(html).toContain('command');
  });
});
