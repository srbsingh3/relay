import './styles.css';

const App = () => {
  const versionLabel = window.relay?.version ?? 'dev';

  return (
    <main className="app-shell">
      <section className="glass-card">
        <header className="card-header">
          <p className="eyebrow">Relay</p>
          <span className="badge">Offline</span>
        </header>
        <h1>Shared MCP Orchestrator</h1>
        <p className="subtitle">
          Hardened Electron shell, deterministic renderer bundle, and isolation flags pave the way for registry, Keychain, and
          sync wiring.
        </p>
        <dl className="status-grid">
          <div>
            <dt>Window</dt>
            <dd>900×600 | Liquid Glass</dd>
          </div>
          <div>
            <dt>Security</dt>
            <dd>Isolation + sandbox enforced</dd>
          </div>
          <div>
            <dt>Renderer</dt>
            <dd>Local assets • CSP `default-src 'self'`</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{versionLabel}</dd>
          </div>
        </dl>
        <footer className="card-footer">
          <span className="tag">Deterministic IO</span>
          <span className="tag">Keychain-only secrets</span>
          <span className="tag">No telemetry</span>
        </footer>
      </section>
    </main>
  );
};

export default App;
