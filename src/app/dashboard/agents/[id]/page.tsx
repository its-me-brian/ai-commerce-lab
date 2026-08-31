"use client";

import { use, useEffect, useState } from "react";

interface AgentConfig {
  agent: {
    id: string;
    name: string;
    description: string;
    status: string;
    enabled: boolean;
  };
  config: {
    primary_provider_id: string;
    primary_model_id: string;
    fallback_provider_id: string | null;
    fallback_model_id: string | null;
    temperature: number;
    max_output_tokens: number;
  } | null;
  providers: Array<{ id: string; name: string; slug: string; enabled: boolean }>;
  models: Array<{
    id: string;
    provider_id: string;
    name: string;
    model_id: string;
    enabled: boolean;
  }>;
  recentRuns: Array<{
    id: string;
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    duration_ms: number;
    status: string;
    created_at: string;
  }>;
}

interface TestResult {
  success: boolean;
  data?: {
    score: number;
    recommendation: string;
    explanation: string;
    estimatedMargin: number;
    demandScore: number;
    competitionScore: number;
    riskScore: number;
  };
  metadata?: {
    providerUsed: string;
    modelUsed: string;
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
  };
  error?: string;
}

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form state
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [fallbackProvider, setFallbackProvider] = useState("");
  const [fallbackModel, setFallbackModel] = useState("");
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(4096);

  // Test form
  const [testProduct, setTestProduct] = useState({
    name: "LED Portable Lamp",
    supplierPrice: 12.40,
    shippingCost: 3.20,
    estimatedSalePrice: 49.90,
  });

  useEffect(() => {
    fetchConfig();
  }, [id]);

  async function fetchConfig() {
    try {
      const res = await fetch(`/api/agents/config?agentId=${id}`);
      const data = await res.json();
      if (data.success) {
        setConfig(data);
        if (data.config) {
          setSelectedProvider(data.config.primary_provider_id);
          setSelectedModel(data.config.primary_model_id);
          setFallbackProvider(data.config.fallback_provider_id || "");
          setFallbackModel(data.config.fallback_model_id || "");
          setTemperature(data.config.temperature);
          setMaxTokens(data.config.max_output_tokens);
        }
      }
    } catch (err) {
      console.error("Failed to load config:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/agents/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: id,
          primaryProviderId: selectedProvider,
          primaryModelId: selectedModel,
          fallbackProviderId: fallbackProvider || null,
          fallbackModelId: fallbackModel || null,
          temperature,
          maxTokens,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: "Configuration saved" });
        fetchConfig();
      } else {
        setToast({ type: "error", message: data.error || "Save failed" });
      }
    } catch {
      setToast({ type: "error", message: "Network error" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/agents/product-hunter/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testProduct),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: "Network error" });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="page-padding" style={{ maxWidth: 900 }}>
        <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 28 }} />
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="page-padding" style={{ maxWidth: 900 }}>
        <p>Agent not found</p>
      </div>
    );
  }

  const filteredModels = config.models.filter(
    (m) => m.provider_id === selectedProvider
  );

  return (
    <div className="page-padding" style={{ maxWidth: 900 }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed", top: 20, right: 20, zIndex: 100,
            padding: "10px 16px", borderRadius: "var(--r-md)",
            background: toast.type === "success" ? "var(--success-bg)" : "var(--error-bg)",
            color: toast.type === "success" ? "var(--success)" : "var(--error)",
            fontSize: "0.8125rem", fontWeight: 500,
            border: `1px solid ${toast.type === "success" ? "var(--success)" : "var(--error)"}`,
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: 4 }}>
          <a href="/dashboard/agents" style={{ color: "var(--accent)", textDecoration: "none" }}>Agents</a>
          {" / "}
          {config.agent.name}
        </p>
        <h1 style={{ marginBottom: 3 }}>{config.agent.name}</h1>
        <p>{config.agent.description}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="config-grid">
        {/* Left: Config */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* AI Configuration */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
            <h2 style={{ marginBottom: 16 }}>AI Configuration</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Provider</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    setSelectedProvider(e.target.value);
                    setSelectedModel("");
                  }}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.8125rem", background: "var(--bg-card)" }}
                >
                  {config.providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.8125rem", background: "var(--bg-card)" }}
                >
                  {filteredModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Temperature</label>
                  <input
                    type="number"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    step={0.1}
                    min={0}
                    max={2}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.8125rem", background: "var(--bg-card)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Max Tokens</label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    step={256}
                    min={256}
                    max={32768}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.8125rem", background: "var(--bg-card)" }}
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: "9px 18px", background: "var(--accent)", color: "white",
                  border: "none", borderRadius: "var(--r-md)", fontSize: "0.8125rem",
                  fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>

          {/* Recent Runs */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
            <h2 style={{ marginBottom: 12 }}>Recent Runs</h2>
            {config.recentRuns.length === 0 ? (
              <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>No runs yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {config.recentRuns.map((run) => (
                  <div key={run.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
                    fontSize: "0.75rem",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: run.status === "success" ? "var(--success)" : "var(--error)",
                      }} />
                      <span style={{ fontWeight: 500 }}>{run.model}</span>
                    </div>
                    <span style={{ color: "var(--text-tertiary)" }}>
                      {run.input_tokens + run.output_tokens} tokens · {(run.duration_ms / 1000).toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Test */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
            <h2 style={{ marginBottom: 16 }}>Test Product Hunter</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Product Name</label>
                <input
                  type="text"
                  value={testProduct.name}
                  onChange={(e) => setTestProduct({ ...testProduct, name: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.8125rem", background: "var(--bg-card)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Supplier Price (€)</label>
                  <input
                    type="number"
                    value={testProduct.supplierPrice}
                    onChange={(e) => setTestProduct({ ...testProduct, supplierPrice: parseFloat(e.target.value) })}
                    step={0.01}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.8125rem", background: "var(--bg-card)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Shipping (€)</label>
                  <input
                    type="number"
                    value={testProduct.shippingCost}
                    onChange={(e) => setTestProduct({ ...testProduct, shippingCost: parseFloat(e.target.value) })}
                    step={0.01}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.8125rem", background: "var(--bg-card)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Sale Price (€)</label>
                  <input
                    type="number"
                    value={testProduct.estimatedSalePrice}
                    onChange={(e) => setTestProduct({ ...testProduct, estimatedSalePrice: parseFloat(e.target.value) })}
                    step={0.01}
                    style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.8125rem", background: "var(--bg-card)" }}
                  />
                </div>
              </div>

              <button
                onClick={handleTest}
                disabled={testing}
                style={{
                  padding: "9px 18px",
                  background: testing ? "var(--bg-sunken)" : "var(--accent)",
                  color: "white", border: "none", borderRadius: "var(--r-md)",
                  fontSize: "0.8125rem", fontWeight: 500,
                  cursor: testing ? "not-allowed" : "pointer",
                }}
              >
                {testing ? "Analyzing..." : "Run Analysis"}
              </button>
            </div>
          </div>

          {/* Results */}
          {testResult && (
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)", padding: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2>Result</h2>
                <span style={{
                  fontSize: "0.6875rem", fontWeight: 500, padding: "2px 8px", borderRadius: 9999,
                  background: testResult.success ? "var(--success-bg)" : "var(--error-bg)",
                  color: testResult.success ? "var(--success)" : "var(--error)",
                }}>
                  {testResult.success ? "Success" : "Error"}
                </span>
              </div>

              {testResult.success && testResult.data ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Score */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
                      {testResult.data.score}
                    </span>
                    <span style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>/100</span>
                  </div>

                  <span style={{
                    fontSize: "0.75rem", fontWeight: 500, padding: "4px 10px", borderRadius: 9999, width: "fit-content",
                    background: testResult.data.recommendation === "INVESTIGATE" ? "var(--success-bg)" :
                      testResult.data.recommendation === "APPROVE" ? "var(--success-bg)" :
                        testResult.data.recommendation === "REJECT" ? "var(--error-bg)" : "var(--warning-bg)",
                    color: testResult.data.recommendation === "INVESTIGATE" ? "var(--success)" :
                      testResult.data.recommendation === "APPROVE" ? "var(--success)" :
                        testResult.data.recommendation === "REJECT" ? "var(--error)" : "var(--warning)",
                  }}>
                    {testResult.data.recommendation}
                  </span>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <MiniStat label="Margin" value={`${testResult.data.estimatedMargin}%`} />
                    <MiniStat label="Demand" value={`${testResult.data.demandScore}/100`} />
                    <MiniStat label="Competition" value={`${testResult.data.competitionScore}/100`} />
                    <MiniStat label="Risk" value={`${testResult.data.riskScore}/100`} />
                  </div>

                  <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {testResult.data.explanation}
                  </p>

                  {testResult.metadata && (
                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12, fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                      {testResult.metadata.modelUsed} · {testResult.metadata.inputTokens + testResult.metadata.outputTokens} tokens · {(testResult.metadata.durationMs / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "0.8125rem", color: "var(--error)" }}>
                  {testResult.error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "8px 12px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)" }}>
      <p style={{ fontSize: "0.625rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: "0.875rem", fontWeight: 600 }}>{value}</p>
    </div>
  );
}
