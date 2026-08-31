import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function ModelsPage() {
  // Fetch providers from Supabase
  const { data: providers } = await supabase
    .from("ai_providers")
    .select("*")
    .order("name");

  // Fetch models from Supabase
  const { data: models } = await supabase
    .from("ai_models")
    .select("*")
    .order("name");

  // Group models by provider
  const providerList = (providers || []).map((p) => ({
    ...p,
    models: (models || []).filter((m: { provider_id: string }) => m.provider_id === p.id),
  }));

  // Check which providers have API keys configured (server-side only)
  const apiKeys: Record<string, boolean> = {
    gemini: !!process.env.GEMINI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    xai: !!process.env.XAI_API_KEY,
  };

  return (
    <div className="page-padding" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>AI Models</h1>
        <p>Configure providers and models for your agents</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {providerList.map((p) => {
          const isActive = apiKeys[p.slug] || false;
          return (
            <div key={p.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "var(--r-md)", flexShrink: 0,
                    background: isActive ? "var(--success-bg)" : "var(--bg-sunken)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isActive ? "var(--success)" : "var(--text-tertiary)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3>{p.name}</h3>
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                      API Key: {isActive ? "Configured" : "Not set"}
                    </p>
                  </div>
                </div>
                <span style={{
                  fontSize: "0.6875rem", fontWeight: 500, padding: "2px 8px", borderRadius: 9999, flexShrink: 0, marginLeft: 8,
                  background: isActive ? "var(--success-bg)" : "var(--warning-bg)",
                  color: isActive ? "var(--success)" : "var(--warning)",
                }}>
                  {isActive ? "Active" : "Setup"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {p.models.map((m: { id: string; name: string; context_window: number; input_price: number; output_price: number; enabled: boolean }) => (
                  <div key={m.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: m.enabled ? "var(--success)" : "var(--border-strong)" }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{m.name}</p>
                        <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                          {(m.context_window / 1000).toFixed(0)}K · ${m.input_price}/${m.output_price} per 1M tokens
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
          );
        })}
      </div>
    </div>
  );
}
