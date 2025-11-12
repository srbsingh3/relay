import './styles.css';

const App = () => {
  return (
    <main className="app-shell">
      <section>
        <p className="eyebrow">Relay</p>
        <h1>Shared MCP Orchestrator</h1>
        <p className="subtitle">Secure offline workspace scaffold ready for registry, Keychain, and sync wiring.</p>
        <p className="env">App version: {window.relay?.version ?? 'dev'}</p>
      </section>
    </main>
  );
};

export default App;
