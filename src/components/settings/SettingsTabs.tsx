"use client";

import { useState, useEffect, useCallback } from "react";

interface EnvVar {
  name: string;
  desc: string;
  set: boolean;
  category: string;
}

interface Provider {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  api_key_env_var: string | null;
  base_url: string | null;
  capabilities: string[];
  enabled: boolean;
}

interface Model {
  id: string;
  provider_id: string;
  name: string;
  model_id: string;
  enabled: boolean;
  context_window: number;
  input_price: number;
  output_price: number;
  capabilities: string[];
}

interface AgentRoute {
  id: string;
  agent_id: string;
  model_id: string;
  priority: number;
  policy: string;
  enabled: boolean;
}

type Tab = "providers" | "models" | "integrations";

export function SettingsTabs({ envStatus }: { envStatus: EnvVar[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("providers");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [routes, setRoutes] = useState<AgentRoute[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [provRes, modelRes, routeRes] = await Promise.all([
        fetch("/api/settings/credentials").then((r) => r.json()),
        fetch("/api/settings/models").then((r) => r.json()),
        fetch("/api/settings/routes").then((r) => r.json()),
      ]);
      setProviders(provRes.credentials || []);
      setModels(modelRes.models || []);
      setRoutes(routeRes.routes || []);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "providers", label: "AI Providers", count: providers.length },
    { id: "models", label: "Models", count: models.length },
    { id: "integrations", label: "Integrations", count: routes.length },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 16px",
              fontSize: "0.8125rem",
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-tertiary)",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
              background: "none",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {tab.label}
            <span style={{
              marginLeft: 6,
              fontSize: "0.6875rem",
              padding: "1px 6px",
              borderRadius: 9999,
              background: "var(--bg-sunken)",
              color: "var(--text-tertiary)",
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>
          Loading...
        </div>
      ) : (
        <>
          {activeTab === "providers" && (
            <ProvidersTab providers={providers} envStatus={envStatus} onRefresh={fetchData} />
          )}
          {activeTab === "models" && (
            <ModelsTab models={models} onRefresh={fetchData} />
          )}
          {activeTab === "integrations" && (
            <IntegrationsTab routes={routes} models={models} onRefresh={fetchData} />
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// PROVIDERS TAB
// ============================================

function ProvidersTab({
  providers,
  envStatus,
  onRefresh,
}: {
  providers: Provider[];
  envStatus: EnvVar[];
  onRefresh: () => void;
}) {
  const providerEnv = envStatus.filter((v) => v.category === "providers");

  return (
    <div>
      {/* Env var status */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 8 }}>Environment Variables</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {providerEnv.map((v) => (
            <div key={v.name} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
              fontSize: "0.75rem",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: v.set ? "var(--success)" : "var(--border-strong)",
                }} />
                <span className="mono" style={{ fontWeight: 500 }}>{v.name}</span>
                <span style={{ color: "var(--text-tertiary)" }}>{v.desc}</span>
              </div>
              <span style={{
                fontSize: "0.6875rem", fontWeight: 500, padding: "2px 8px", borderRadius: 9999,
                background: v.set ? "var(--success-bg)" : "var(--bg-hover)",
                color: v.set ? "var(--success)" : "var(--text-tertiary)",
              }}>
                {v.set ? "Configured" : "Not set"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* DB providers */}
      <div>
        <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 8 }}>Registered Providers</h3>
        {providers.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", padding: 20, textAlign: "center" }}>
            No providers registered. Providers are auto-registered from environment variables.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {providers.map((p) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
              }}>
                <div>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{p.name}</p>
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>{p.slug}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: "0.625rem", padding: "2px 6px", borderRadius: 4,
                    background: "var(--bg-hover)", color: "var(--text-tertiary)",
                  }}>
                    {p.capabilities?.join(", ")}
                  </span>
                  <span style={{
                    fontSize: "0.6875rem", fontWeight: 500, padding: "2px 8px", borderRadius: 9999,
                    background: p.enabled ? "var(--success-bg)" : "var(--bg-hover)",
                    color: p.enabled ? "var(--success)" : "var(--text-tertiary)",
                  }}>
                    {p.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MODELS TAB
// ============================================

function ModelsTab({
  models,
  onRefresh,
}: {
  models: Model[];
  onRefresh: () => void;
}) {
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  const handleToggle = async (id: string, enabled: boolean) => {
    await fetch(`/api/settings/models?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    onRefresh();
  };

  const handleTest = async (providerId: string, modelId: string) => {
    setTesting(modelId);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, model: modelId }),
      });
      const data = await res.json();
      setTestResult({ id: modelId, ok: data.success, msg: data.error || "Connection OK" });
    } catch {
      setTestResult({ id: modelId, ok: false, msg: "Test failed" });
    } finally {
      setTesting(null);
    }
  };

  // Group by provider
  const byProvider = models.reduce<Record<string, Model[]>>((acc, m) => {
    (acc[m.provider_id] = acc[m.provider_id] || []).push(m);
    return acc;
  }, {});

  return (
    <div>
      {Object.entries(byProvider).map(([providerId, providerModels]) => (
        <div key={providerId} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 8, textTransform: "capitalize" }}>
            {providerId}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {providerModels.map((m) => (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{m.name}</p>
                    <span className="mono" style={{ fontSize: "0.625rem", color: "var(--text-tertiary)" }}>
                      {m.model_id}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                    {(m.context_window / 1000).toFixed(0)}K ctx · ${m.input_price}/${m.output_price} per M
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => handleTest(providerId, m.model_id)}
                    disabled={testing === m.model_id}
                    style={{
                      fontSize: "0.6875rem", padding: "4px 10px", borderRadius: 6,
                      border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {testing === m.model_id ? "Testing..." : "Test"}
                  </button>
                  <button
                    onClick={() => handleToggle(m.id, !m.enabled)}
                    style={{
                      fontSize: "0.6875rem", padding: "4px 10px", borderRadius: 6,
                      border: "none", cursor: "pointer",
                      background: m.enabled ? "var(--success-bg)" : "var(--bg-hover)",
                      color: m.enabled ? "var(--success)" : "var(--text-tertiary)",
                    }}
                  >
                    {m.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {testResult && testResult.id.startsWith(providerId) && (
            <div style={{
              marginTop: 6, padding: "6px 12px", borderRadius: 6, fontSize: "0.6875rem",
              background: testResult.ok ? "var(--success-bg)" : "var(--error-bg)",
              color: testResult.ok ? "var(--success)" : "var(--error)",
            }}>
              {testResult.msg}
            </div>
          )}
        </div>
      ))}
      {models.length === 0 && (
        <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", padding: 20, textAlign: "center" }}>
          No models registered. Run migration 038 to seed Qwen/DeepSeek models.
        </p>
      )}
    </div>
  );
}

// ============================================
// INTEGRATIONS TAB
// ============================================

function IntegrationsTab({
  routes,
  models,
  onRefresh,
}: {
  routes: AgentRoute[];
  models: Model[];
  onRefresh: () => void;
}) {
  // Group routes by agent
  const byAgent = routes.reduce<Record<string, AgentRoute[]>>((acc, r) => {
    (acc[r.agent_id] = acc[r.agent_id] || []).push(r);
    return acc;
  }, {});

  const getModelName = (modelId: string) => {
    const m = models.find((x) => x.id === modelId);
    return m ? `${m.name} (${m.provider_id})` : modelId;
  };

  return (
    <div>
      <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: 16 }}>
        Agent → Model routing. Controls which models each agent can use and in what priority order.
      </p>
      {Object.entries(byAgent).length === 0 ? (
        <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", padding: 20, textAlign: "center" }}>
          No routes configured. Run migration 038 to seed default routes.
        </p>
      ) : (
        Object.entries(byAgent).map(([agentId, agentRoutes]) => (
          <div key={agentId} style={{
            marginBottom: 16, padding: 14, background: "var(--bg-sunken)",
            borderRadius: "var(--r-md)", border: "1px solid var(--border)",
          }}>
            <h4 style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 8, textTransform: "capitalize" }}>
              {agentId.replace(/-/g, " ")}
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {agentRoutes.sort((a, b) => a.priority - b.priority).map((r) => (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 10px", background: "var(--bg-card)", borderRadius: 4,
                  fontSize: "0.75rem",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: "0.625rem", padding: "1px 4px", borderRadius: 3,
                      background: "var(--bg-hover)", color: "var(--text-tertiary)", fontFamily: "monospace",
                    }}>
                      P{r.priority}
                    </span>
                    <span>{getModelName(r.model_id)}</span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: "0.625rem" }}>
                      {r.policy}
                    </span>
                  </div>
                  <span style={{
                    fontSize: "0.625rem", padding: "1px 6px", borderRadius: 9999,
                    background: r.enabled ? "var(--success-bg)" : "var(--bg-hover)",
                    color: r.enabled ? "var(--success)" : "var(--text-tertiary)",
                  }}>
                    {r.enabled ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
