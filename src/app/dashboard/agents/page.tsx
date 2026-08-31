import { supabase } from "@/lib/database/supabase";

export default async function AgentsPage() {
  // Fetch agents from Supabase
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("*")
    .order("name");

  if (agentsError) {
    console.error("[AgentsPage] Failed to load agents:", agentsError.message);
  }

  // Fetch configs to show model/provider info
  const { data: configs } = await supabase
    .from("agent_configs")
    .select("agent_id, primary_provider_id, primary_model_id");

  // Fetch models to resolve model names
  const { data: models } = await supabase
    .from("ai_models")
    .select("id, name");

  // Fetch providers to resolve provider names
  const { data: providers } = await supabase
    .from("ai_providers")
    .select("id, name");

  // Build a lookup map for config info
  const configMap = new Map(
    (configs || []).map((c) => [c.agent_id, c])
  );
  const modelMap = new Map(
    (models || []).map((m) => [m.id, m.name])
  );
  const providerMap = new Map(
    (providers || []).map((p) => [p.id, p.name])
  );

  const agentList = (agents || []).map((a) => {
    const cfg = configMap.get(a.id);
    return {
      ...a,
      modelName: cfg ? modelMap.get(cfg.primary_model_id) || "-" : "-",
      providerName: cfg ? providerMap.get(cfg.primary_provider_id) || "-" : "-",
    };
  });

  return (
    <div className="page-padding" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Agents</h1>
        <p>Manage and configure your AI agents</p>
      </div>

      {agentsError && (
        <div style={{
          padding: "12px 16px", marginBottom: 16,
          background: "var(--error-bg)", color: "var(--error)",
          borderRadius: "var(--r-md)", fontSize: "0.8125rem",
        }}>
          Failed to load agents. Please try refreshing.
        </div>
      )}

      <div className="agents-grid" style={{ display: "grid", gap: 14 }}>
        {agentList.map((a) => (
          <div key={a.id} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", padding: 20,
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ marginBottom: 2 }}>{a.name}</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{a.description}</p>
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
                <p style={{ fontSize: "0.75rem", fontWeight: 500 }}>{a.modelName}</p>
              </div>
              <div style={{ width: 1, background: "var(--border)" }} />
              <div>
                <p style={{ fontSize: "0.625rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Provider</p>
                <p style={{ fontSize: "0.75rem", fontWeight: 500 }}>{a.providerName}</p>
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
