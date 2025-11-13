import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

describe('App layout', () => {
  it('renders the servers pane and settings entry point', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Workspace registry');
    expect(html).toContain('Settings');
    expect(html).toContain('Relay status');
  });
});
