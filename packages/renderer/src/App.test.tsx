import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

describe('App layout', () => {
  it('renders server rows with per-app toggles and master switch states', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Workspace registry');
    expect(html).toContain('Settings');
    expect(html).toContain('Relay status');
    expect(html).toContain('All apps');
    expect(html).toContain('app-pill--disabled');
    expect(html).toContain('switch--custom');
  });
});
