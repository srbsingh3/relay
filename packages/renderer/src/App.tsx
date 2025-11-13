import './styles.css';

const placeholderServers = [
  {
    id: 'srv_workspace',
    name: 'Workspace Relay',
    command: 'uvx relay serve workspace',
    apps: ['Cursor', 'Claude', 'Codex'],
    state: 'running'
  },
  {
    id: 'srv_research',
    name: 'Research Drafts',
    command: 'bun relay sync research',
    apps: ['Cursor', 'Claude'],
    state: 'idle'
  }
];

const App = () => {
  const versionLabel = typeof window !== 'undefined' ? window.relay?.version ?? 'dev' : 'dev';

  return (
    <main className="app-shell">
      <div className="app-layout">
        <header className="app-header">
          <div className="brand-cluster">
            <p className="eyebrow">Relay</p>
            <h1>Shared MCP Orchestrator</h1>
            <p className="subcopy">
              macOS-only shell keeps Cursor, Claude, and Codex servers in sync with deterministic IO, Keychain secrets, and
              offline defaults.
            </p>
          </div>
          <button className="settings-button" type="button" aria-label="Open settings panel">
            Settings
          </button>
        </header>
        <div className="content-grid">
          <section className="pane servers-pane" aria-labelledby="servers-heading">
            <div className="section-header">
              <div>
                <p className="section-eyebrow">Servers</p>
                <h2 id="servers-heading">Workspace registry</h2>
              </div>
              <button className="ghost-button" type="button">
                Add server
              </button>
            </div>
            <ul className="server-list">
              {placeholderServers.map((server) => (
                <li className="server-card" key={server.id}>
                  <div className="server-card-head">
                    <div>
                      <p className="server-name">{server.name}</p>
                      <p className="server-command">{server.command}</p>
                    </div>
                    <span className={`server-status server-status--${server.state}`}>
                      {server.state === 'running' ? 'Live' : 'Idle'}
                    </span>
                  </div>
                  <div className="apps-row" aria-label="Enabled apps">
                    {server.apps.map((app) => (
                      <span className="app-pill" key={`${server.id}-${app}`}>
                        {app}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="pane detail-pane" aria-labelledby="overview-heading">
            <div className="section-header">
              <div>
                <p className="section-eyebrow">Overview</p>
                <h2 id="overview-heading">Relay status</h2>
              </div>
              <span className="badge">Offline-first</span>
            </div>
            <p className="detail-copy">
              Every UI action, tray entry, and scheduled sync routes through the same hardened services so registry, Keychain,
              and detection state stay deterministic even without a network connection.
            </p>
            <dl className="status-grid compact">
              <div>
                <dt>Version</dt>
                <dd>{versionLabel}</dd>
              </div>
              <div>
                <dt>Window</dt>
                <dd>900×600 | Liquid Glass</dd>
              </div>
              <div>
                <dt>Security</dt>
                <dd>Isolation + sandbox enforced</dd>
              </div>
              <div>
                <dt>Assets</dt>
                <dd>Local bundle • CSP locked</dd>
              </div>
            </dl>
          </section>
        </div>
        <footer className="app-footer">
          <span className="tag">Deterministic IO</span>
          <span className="tag">Keychain-only secrets</span>
          <span className="tag">No telemetry</span>
        </footer>
      </div>
    </main>
  );
};

export default App;
