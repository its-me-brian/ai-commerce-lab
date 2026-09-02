// §38: Settings page with Configured/Not configured/Error status indicators

export default function SettingsPage() {
  // Check env vars server-side (never expose values to client)
  const vars = [
    { name: "GEMINI_API_KEY", desc: "Google Gemini", set: !!process.env.GEMINI_API_KEY, secret: true, category: "providers" },
    { name: "ANTHROPIC_API_KEY", desc: "Anthropic Claude", set: !!process.env.ANTHROPIC_API_KEY, secret: true, category: "providers" },
    { name: "XAI_API_KEY", desc: "xAI Grok", set: !!process.env.XAI_API_KEY, secret: true, category: "providers" },
    { name: "SUPABASE_URL", desc: "Project URL", set: !!process.env.SUPABASE_URL, secret: false, category: "database" },
    { name: "SUPABASE_ANON_KEY", desc: "Anonymous key", set: !!process.env.SUPABASE_ANON_KEY, secret: false, category: "database" },
    { name: "EBAY_CLIENT_ID", desc: "eBay Browse API (product source)", set: !!process.env.EBAY_CLIENT_ID, secret: true, category: "sources" },
    { name: "EBAY_CLIENT_SECRET", desc: "eBay Browse API secret", set: !!process.env.EBAY_CLIENT_SECRET, secret: true, category: "sources" },
  ];

  const providers = vars.filter((v) => v.category === "providers");
  const database = vars.filter((v) => v.category === "database");
  const sources = vars.filter((v) => v.category === "sources");

  const configuredCount = vars.filter((v) => v.set).length;
  const totalCount = vars.length;
  const allConfigured = configuredCount === totalCount;
  const noneConfigured = configuredCount === 0;

  return (
    <div className="page-padding" style={{ maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Settings</h1>
        <p>Environment variables and configuration</p>
      </div>

      {/* Overall status banner */}
      <div
        className="flex items-center gap-3 p-4 mb-6"
        style={{
          background: allConfigured ? "var(--success-bg)" : noneConfigured ? "var(--bg-sunken)" : "var(--warning-bg, #fef3c7)",
          border: `1px solid ${allConfigured ? "var(--success)" : noneConfigured ? "var(--border)" : "var(--warning, #d97706)"}`,
          borderRadius: "var(--r-lg)",
        }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: allConfigured ? "var(--success)" : noneConfigured ? "var(--text-tertiary)" : "var(--warning, #d97706)",
          }}
        >
          {allConfigured ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : noneConfigured ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {allConfigured ? "All configured" : noneConfigured ? "Not configured" : "Partially configured"}
          </p>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {configuredCount} of {totalCount} variables set
          </p>
        </div>
      </div>

      {/* Provider configs */}
      <ConfigSection title="AI Providers" vars={providers} />

      {/* Database configs */}
      <ConfigSection title="Database" vars={database} />

      {/* Data sources */}
      <ConfigSection title="Data Sources" vars={sources} />
    </div>
  );
}

function ConfigSection({ title, vars }: { title: string; vars: Array<{ name: string; desc: string; set: boolean }> }) {
  const allSet = vars.every((v) => v.set);
  const noneSet = vars.every((v) => !v.set);

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20, marginBottom: 16 }}>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: "0.875rem", fontWeight: 600 }}>{title}</h2>
        <StatusIndicator status={allSet ? "configured" : noneSet ? "not_configured" : "partial"} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {vars.map((v) => (
          <div key={v.name} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <StatusDot configured={v.set} />
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
              {v.set ? "Configured" : "Not set"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ configured }: { configured: boolean }) {
  return (
    <div
      style={{
        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
        background: configured ? "var(--success)" : "var(--border-strong)",
      }}
    />
  );
}

function StatusIndicator({ status }: { status: "configured" | "not_configured" | "partial" | "error" }) {
  const styles = {
    configured: { bg: "var(--success-bg)", color: "var(--success)", label: "Configured" },
    not_configured: { bg: "var(--bg-sunken)", color: "var(--text-tertiary)", label: "Not configured" },
    partial: { bg: "var(--warning-bg, #fef3c7)", color: "var(--warning, #d97706)", label: "Partial" },
    error: { bg: "var(--error-bg)", color: "var(--error)", label: "Error" },
  };

  const s = styles[status];

  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}
