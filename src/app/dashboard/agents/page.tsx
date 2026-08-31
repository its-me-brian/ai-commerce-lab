export default function AgentsPage() {
  const agents = [
    { id: "product-hunter", name: "Product Hunter", desc: "Searches and evaluates ecommerce opportunities", status: "ready", model: "Gemini 3 Flash", provider: "Google" },
    { id: "store-builder", name: "Store Builder", desc: "Creates product listings and store content", status: "coming-soon", model: "-", provider: "-" },
    { id: "marketing", name: "Marketing", desc: "Generates ad copy, hooks, and campaigns", status: "coming-soon", model: "-", provider: "-" },
    { id: "secretary", name: "Secretary", desc: "Manages supplier communication", status: "coming-soon", model: "-", provider: "-" },
    { id: "finance", name: "Finance", desc: "Tracks costs, margins, and profitability", status: "coming-soon", model: "-", provider: "-" },
    { id: "ceo", name: "CEO", desc: "Orchestrates all agents and decisions", status: "coming-soon", model: "-", provider: "-" },
  ];

  return (
    <div className="page-padding" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Agents</h1>
        <p>Manage and configure your AI agents</p>
      </div>

      <div className="agents-grid" style={{ display: "grid", gap: 14 }}>
        {agents.map((a) => (
          <div key={a.id} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", padding: 20,
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ marginBottom: 2 }}>{a.name}</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{a.desc}</p>
              </div>
              <span style={{
                fontSize: "0.6875rem", fontWeight: 500, padding: "2px 8px", borderRadius: 9999, flexShrink: 0, marginLeft: 8,
                background: a.status === "ready" ? "var(--success-bg)" : "var(--bg-sunken)",
                color: a.status === "ready" ? "var(--success)" : "var(--text-tertiary)",
              }}>
                {a.status === "ready" ? "Ready" : "Soon"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 16, padding: "10px 14px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)", marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: "0.625rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Model</p>
                <p style={{ fontSize: "0.75rem", fontWeight: 500 }}>{a.model}</p>
              </div>
              <div style={{ width: 1, background: "var(--border)" }} />
              <div>
                <p style={{ fontSize: "0.625rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Provider</p>
                <p style={{ fontSize: "0.75rem", fontWeight: 500 }}>{a.provider}</p>
              </div>
            </div>

            <div style={{ marginTop: "auto" }}>
              {a.status === "ready" ? (
                <a href={`/dashboard/agents/${a.id}`} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "7px 14px", background: "var(--accent)", color: "white",
                  borderRadius: "var(--r-md)", fontSize: "0.75rem", fontWeight: 500, textDecoration: "none",
                }}>
                  Configure
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 2.5l4 3.5-4 3.5" /></svg>
                </a>
              ) : (
                <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>Coming soon</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
