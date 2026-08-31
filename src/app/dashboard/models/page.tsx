export default function ModelsPage() {
  const providers = [
    {
      name: "Google Gemini", slug: "gemini", active: true,
      models: [{ id: "gemini-3-flash-preview", name: "Gemini 3 Flash", ctx: "1M", price: "Free", enabled: true }],
    },
    {
      name: "Anthropic Claude", slug: "anthropic", active: false,
      models: [
        { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku", ctx: "200K", price: "$0.80/$4.00", enabled: false },
        { id: "claude-sonnet-4", name: "Claude Sonnet 4", ctx: "200K", price: "$3/$15", enabled: false },
      ],
    },
    {
      name: "xAI Grok", slug: "xai", active: false,
      models: [{ id: "grok-3-mini", name: "Grok 3 Mini", ctx: "128K", price: "$0.30/$0.50", enabled: false }],
    },
  ];

  return (
    <div className="page-padding" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>AI Models</h1>
        <p>Configure providers and models for your agents</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {providers.map((p) => (
          <div key={p.slug} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "var(--r-md)", flexShrink: 0,
                  background: p.active ? "var(--success-bg)" : "var(--bg-sunken)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={p.active ? "var(--success)" : "var(--text-tertiary)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3>{p.name}</h3>
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                    API Key: {p.active ? "Configured" : "Not set"}
                  </p>
                </div>
              </div>
              <span style={{
                fontSize: "0.6875rem", fontWeight: 500, padding: "2px 8px", borderRadius: 9999, flexShrink: 0, marginLeft: 8,
                background: p.active ? "var(--success-bg)" : "var(--warning-bg)",
                color: p.active ? "var(--success)" : "var(--warning)",
              }}>
                {p.active ? "Active" : "Setup"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {p.models.map((m) => (
                <div key={m.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: m.enabled ? "var(--success)" : "var(--border-strong)" }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{m.name}</p>
                      <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                        {m.ctx} · {m.price}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 500, flexShrink: 0, marginLeft: 8, color: m.enabled ? "var(--success)" : "var(--text-tertiary)" }}>
                    {m.enabled ? "On" : "Off"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
