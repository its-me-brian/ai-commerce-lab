"use client";

import { use, useEffect, useState } from "react";

interface AgentConfig {
  agent: {
    id: string;
    name: string;
    description: string;
    status: string;
    enabled: boolean;
    identity: {
      name: string;
      role: string;
      description: string;
    } | null;
    mission: string | null;
    personality: {
      traits: string[];
      communicationStyle: string[];
      decisionStyle: string;
    } | null;
    expertise: string[] | null;
    agent_rules: string[] | null;
    output_instructions: {
      format: string;
      constraints?: string[];
    } | null;
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
  skills: Array<{
    skill_id: string;
    skills: {
      id: string;
      name: string;
      slug: string;
      description: string;
      category: string;
    };
  }>;
}

// Default test inputs per agent type
const DEFAULT_TEST_INPUTS: Record<string, string> = {
  "product-hunter": JSON.stringify({
    name: "LED Portable Lamp",
    supplierPrice: 12.40,
    shippingCost: 3.20,
    estimatedSalePrice: 49.90,
  }, null, 2),
};

const DISCOVER_TEST_INPUT = JSON.stringify({
  mode: "discover",
  query: "wireless earbuds",
  source: "dummyjson",
  limit: 5,
}, null, 2);

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
  const [testResult, setTestResult] = useState<{
    success: boolean;
    data?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    error?: string;
  } | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form state
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [fallbackProvider, setFallbackProvider] = useState("");
  const [fallbackModel, setFallbackModel] = useState("");
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(4096);

  // Test form — generic JSON input
  const [testInput, setTestInput] = useState(
    DEFAULT_TEST_INPUTS[id] || '{\n  "name": "Test Product",\n  "supplierPrice": 10\n}'
  );
  const [testInputError, setTestInputError] = useState("");
  const [searchMode, setSearchMode] = useState<"analyze" | "discover">("analyze");
  const [searchSource, setSearchSource] = useState("dummyjson");

  useEffect(() => {
    fetchConfig();
    setTestInput(DEFAULT_TEST_INPUTS[id] || '{\n  "name": "Test Product",\n  "supplierPrice": 10\n}');
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
    setTestInputError("");

    // Parse JSON input
    let input: Record<string, unknown>;
    try {
      input = JSON.parse(testInput);
    } catch {
      setTestInputError("Invalid JSON");
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: id, input }),
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

  const isProductHunter = id === "product-hunter";

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
          {config.agent.identity?.name || config.agent.name}
        </p>
        <h1 style={{ marginBottom: 3 }}>{config.agent.identity?.name || config.agent.name}</h1>
        <p>{config.agent.identity?.role || config.agent.description}</p>
      </div>

      {/* Agent Definition (Identity, Mission, Personality, Expertise, Rules, Skills) */}
      {config.agent.identity && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20, marginBottom: 14 }}>
          <h2 style={{ marginBottom: 16 }}>Agent Definition</h2>

          {/* Identity + Mission */}
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 6 }}>Identity</h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 8 }}>
              {config.agent.identity.description}
            </p>
            {config.agent.mission && (
              <>
                <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 6 }}>Mission</h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>{config.agent.mission}</p>
              </>
            )}
          </div>

          {/* Personality */}
          {config.agent.personality && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 6 }}>Personality</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {config.agent.personality.traits.map((trait) => (
                  <span key={trait} style={{
                    fontSize: "0.6875rem", padding: "2px 8px", borderRadius: 9999,
                    background: "var(--bg-sunken)", color: "var(--text-secondary)",
                  }}>{trait}</span>
                ))}
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                Communication: {config.agent.personality.communicationStyle.join(", ")}
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
                Decision: {config.agent.personality.decisionStyle}
              </p>
            </div>
          )}

          {/* Expertise */}
          {config.agent.expertise && config.agent.expertise.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 6 }}>Expertise</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {config.agent.expertise.map((item) => (
                  <span key={item} style={{
                    fontSize: "0.6875rem", padding: "2px 8px", borderRadius: 9999,
                    background: "var(--accent-bg)", color: "var(--accent)",
                  }}>{item}</span>
                ))}
              </div>
            </div>
          )}

          {/* Rules */}
          {config.agent.agent_rules && config.agent.agent_rules.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 6 }}>Rules</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {config.agent.agent_rules.map((rule, i) => (
                  <li key={i} style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 4 }}>{rule}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills */}
          {config.skills && config.skills.length > 0 && (
            <div>
              <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 6 }}>Skills</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {config.skills.map((s) => (
                  <span key={s.skill_id} style={{
                    fontSize: "0.6875rem", padding: "2px 8px", borderRadius: 9999,
                    background: "var(--success-bg)", color: "var(--success)",
                  }}>{s.skills.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
            <h2 style={{ marginBottom: 4 }}>Test Agent</h2>
            <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: 16 }}>
              {isProductHunter
                ? "Analyze a product opportunity"
                : `Send input to ${config.agent.name}`}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Input (JSON)</label>
                <textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  rows={8}
                  className="mono"
                  style={{
                    width: "100%", padding: "8px 12px", border: `1px solid ${testInputError ? "var(--error)" : "var(--border)"}`,
                    borderRadius: "var(--r-md)", fontSize: "0.75rem", background: "var(--bg-card)",
                    resize: "vertical", lineHeight: 1.5,
                  }}
                />
                {testInputError && (
                  <p style={{ fontSize: "0.6875rem", color: "var(--error)", marginTop: 4 }}>{testInputError}</p>
                )}
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
                {testing ? "Running..." : "Run Agent"}
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

              {testResult.success ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Product Hunter: Mode + Source selectors */}
              {isProductHunter && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Mode</label>
                    <select
                      value={searchMode}
                      onChange={(e) => {
                        const mode = e.target.value as "analyze" | "discover";
                        setSearchMode(mode);
                        if (mode === "discover") {
                          setTestInput(DISCOVER_TEST_INPUT.replace('"dummyjson"', `"${searchSource}"`));
                        } else {
                          setTestInput(DEFAULT_TEST_INPUTS[id] || '{\n  "name": "Test Product",\n  "supplierPrice": 10\n}');
                        }
                      }}
                      style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.8125rem", background: "var(--bg-card)" }}
                    >
                      <option value="analyze">Analyze (provide product)</option>
                      <option value="discover">Discover (search products)</option>
                    </select>
                  </div>
                  {searchMode === "discover" && (
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Source</label>
                      <select
                        value={searchSource}
                        onChange={(e) => {
                          setSearchSource(e.target.value);
                          // Update source in current JSON input
                          try {
                            const parsed = JSON.parse(testInput);
                            parsed.source = e.target.value;
                            setTestInput(JSON.stringify(parsed, null, 2));
                          } catch {
                            // If JSON is invalid, just update the state
                          }
                        }}
                        style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.8125rem", background: "var(--bg-card)" }}
                      >
                        <option value="dummyjson">DummyJSON (194 products)</option>
                        <option value="fakestore">FakeStore (20 products)</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
                  {/* Product Hunter specific display */}
                  {isProductHunter && testResult.data && typeof testResult.data === "object" && "score" in testResult.data ? (
                    <>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
                          {(testResult.data as Record<string, unknown>).score as number}
                        </span>
                        <span style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>/100</span>
                      </div>

                      <span style={{
                        fontSize: "0.75rem", fontWeight: 500, padding: "4px 10px", borderRadius: 9999, width: "fit-content",
                        background: "var(--success-bg)", color: "var(--success)",
                      }}>
                        {(testResult.data as Record<string, unknown>).recommendation as string}
                      </span>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <MiniStat label="Margin" value={`${(testResult.data as Record<string, unknown>).estimatedMargin}%`} />
                        <MiniStat label="Demand" value={`${(testResult.data as Record<string, unknown>).demandScore}/100`} />
                        <MiniStat label="Competition" value={`${(testResult.data as Record<string, unknown>).competitionScore}/100`} />
                        <MiniStat label="Risk" value={`${(testResult.data as Record<string, unknown>).riskScore}/100`} />
                      </div>

                      <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                        {(testResult.data as Record<string, unknown>).explanation as string}
                      </p>
                    </>
                  ) : (
                    /* Generic JSON display */
                    <pre className="mono" style={{
                      fontSize: "0.75rem", background: "var(--bg-sunken)", padding: 12,
                      borderRadius: "var(--r-md)", overflow: "auto", maxHeight: 400, lineHeight: 1.5,
                    }}>
                      {JSON.stringify(testResult.data || testResult, null, 2)}
                    </pre>
                  )}

                  {testResult.metadata && (
                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12, fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                      {(testResult.metadata as Record<string, unknown>).modelUsed as string} · {" "}
                      {((testResult.metadata as Record<string, unknown>).inputTokens as number) + ((testResult.metadata as Record<string, unknown>).outputTokens as number)} tokens · {" "}
                      {(((testResult.metadata as Record<string, unknown>).durationMs as number) / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "0.8125rem", color: "var(--error)" }}>
                  {testResult.error as string}
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
