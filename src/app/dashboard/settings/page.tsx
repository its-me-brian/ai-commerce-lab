export default function SettingsPage() {
  // Check env vars server-side (never expose values to client)
  const vars = [
    { name: "GEMINI_API_KEY", desc: "Google Gemini", set: !!process.env.GEMINI_API_KEY, secret: true },
    { name: "ANTHROPIC_API_KEY", desc: "Anthropic Claude", set: !!process.env.ANTHROPIC_API_KEY, secret: true },
    { name: "XAI_API_KEY", desc: "xAI Grok", set: !!process.env.XAI_API_KEY, secret: true },
    { name: "SUPABASE_URL", desc: "Project URL", set: !!process.env.SUPABASE_URL, secret: false },
    { name: "SUPABASE_ANON_KEY", desc: "Anonymous key", set: !!process.env.SUPABASE_ANON_KEY, secret: false },
    { name: "EBAY_CLIENT_ID", desc: "eBay Browse API (product source)", set: !!process.env.EBAY_CLIENT_ID, secret: true },
    { name: "EBAY_CLIENT_SECRET", desc: "eBay Browse API secret", set: !!process.env.EBAY_CLIENT_SECRET, secret: true },
  ];

  return (
    <div className="page-padding" style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Settings</h1>
        <p>Environment variables and configuration</p>
      </div>

      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
        <h2 style={{ marginBottom: 4 }}>Environment Variables</h2>
        <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: 16 }}>
          Stored in <code>.env.local</code> — never exposed to the browser.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {vars.map((v) => (
            <div key={v.name} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: v.set ? "var(--success)" : "var(--border-strong)" }} />
                <div style={{ minWidth: 0 }}>
                  <p className="mono" style={{ fontSize: "0.75rem", fontWeight: 500 }}>{v.name}</p>
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>{v.desc}</p>
                </div>
              </div>
              <span style={{
                fontSize: "0.6875rem", fontWeight: 500, padding: "2px 8px", borderRadius: 9999, flexShrink: 0, marginLeft: 8,
                background: v.set ? "var(--success-bg)" : "var(--bg-hover)",
                color: v.set ? "var(--success)" : "var(--text-tertiary)",
              }}>
                {v.set ? "Set" : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
