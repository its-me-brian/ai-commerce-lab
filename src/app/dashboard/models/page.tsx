"use client";

import { useEffect, useState } from "react";

interface Provider {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  enabled: boolean;
  models: Model[];
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

interface ProviderStatus {
  slug: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  credentialSource: "env" | "database" | "none";
  registered: boolean;
}

interface TestResult {
  success: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  credentialSource: string;
  error?: string;
}

export default function ModelsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [statusRes, modelsRes] = await Promise.all([
        fetch("/api/ai/providers"),
        fetch("/api/ai/models"),
      ]);

      const statusData = await statusRes.json();
      if (statusData.providers) {
        setProviderStatuses(statusData.providers);
      }

      // Build providers list from statuses
      const providersList: Provider[] = (statusData.providers || []).map((s: ProviderStatus) => ({
        id: s.slug,
        name: s.name,
        slug: s.slug,
        description: null,
        enabled: s.enabled,
        models: [],
      }));
      setProviders(providersList);

      // Attach models to their providers
      const modelsData = await modelsRes.json();
      if (modelsData.models) {
        setProviders(prev => prev.map(p => ({
          ...p,
          models: modelsData.models.filter((m: Model) => m.provider_id === p.id),
        })));
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleProvider(id: string, enabled: boolean) {
    try {
      const res = await fetch("/api/ai/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setProviders(prev => prev.map(p => p.id === id ? { ...p, enabled } : p));
        setProviderStatuses(prev => prev.map(s => s.slug === id ? { ...s, enabled } : s));
        setToast({ type: "success", message: `Provider ${enabled ? "enabled" : "disabled"}` });
      } else {
        setToast({ type: "error", message: data.error || "Failed to update provider" });
      }
    } catch {
      setToast({ type: "error", message: "Network error" });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function toggleModel(id: string, enabled: boolean) {
    try {
      const res = await fetch("/api/ai/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      const data = await res.json();
      if (data.success) {
        setProviders(prev => prev.map(p => ({
          ...p,
          models: p.models.map(m => m.id === id ? { ...m, enabled } : m),
        })));
        setToast({ type: "success", message: `Model ${enabled ? "enabled" : "disabled"}` });
      } else {
        setToast({ type: "error", message: data.error || "Failed to update model" });
      }
    } catch {
      setToast({ type: "error", message: "Network error" });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function testConnection(slug: string) {
    setTesting(slug);
    setTestResults(prev => ({ ...prev, [slug]: undefined as unknown as TestResult }));
    try {
      const res = await fetch("/api/ai/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: slug }),
      });
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [slug]: data }));
    } catch {
      setTestResults(prev => ({
        ...prev,
        [slug]: { success: false, provider: slug, model: "unknown", latencyMs: 0, credentialSource: "none", error: "Network error" },
      }));
    } finally {
      setTesting(null);
    }
  }

  if (loading) {
    return (
      <div className="page-padding" style={{ maxWidth: 800 }}>
        <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 28 }} />
        <div className="skeleton" style={{ height: 400 }} />
      </div>
    );
  }

  return (
    <div className="page-padding" style={{ maxWidth: 800 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 100,
          padding: "10px 16px", borderRadius: "var(--r-md)",
          background: toast.type === "success" ? "var(--success-bg)" : "var(--error-bg)",
          color: toast.type === "success" ? "var(--success)" : "var(--error)",
          fontSize: "0.8125rem", fontWeight: 500,
          border: `1px solid ${toast.type === "success" ? "var(--success)" : "var(--error)"}`,
        }}>
          {toast.message}
        </div>
      )}

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>AI Models</h1>
        <p>Configure providers and models for your agents</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {providerStatuses.map((status) => {
          const provider = providers.find(p => p.id === status.slug);
          const testResult = testResults[status.slug];

          return (
            <div key={status.slug} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)", padding: 20,
            }}>
              {/* Provider header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "var(--r-md)", flexShrink: 0,
                    background: status.configured ? "var(--success-bg)" : "var(--bg-sunken)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={status.configured ? "var(--success)" : "var(--text-tertiary)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3>{status.name}</h3>
                      <span style={{
                        fontSize: "0.625rem", fontWeight: 500, padding: "1px 6px", borderRadius: 9999,
                        background: status.configured ? "var(--success-bg)" : "var(--bg-sunken)",
                        color: status.configured ? "var(--success)" : "var(--text-tertiary)",
                      }}>
                        {status.configured ? `Key: ${status.credentialSource}` : "No key"}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                      {status.enabled ? "Enabled" : "Disabled"} · {status.registered ? "Registered" : "Not registered"}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {/* Test connection button */}
                  <button
                    onClick={() => testConnection(status.slug)}
                    disabled={testing === status.slug || !status.configured}
                    style={{
                      padding: "5px 12px", fontSize: "0.75rem", fontWeight: 500,
                      background: "var(--bg-sunken)", color: "var(--text-secondary)",
                      border: "1px solid var(--border)", borderRadius: "var(--r-md)",
                      cursor: testing === status.slug || !status.configured ? "not-allowed" : "pointer",
                      opacity: testing === status.slug || !status.configured ? 0.5 : 1,
                    }}
                  >
                    {testing === status.slug ? "Testing..." : "Test"}
                  </button>

                  {/* Enable/disable toggle */}
                  <button
                    onClick={() => toggleProvider(status.slug, !status.enabled)}
                    style={{
                      padding: "5px 12px", fontSize: "0.75rem", fontWeight: 500,
                      background: status.enabled ? "var(--success-bg)" : "var(--bg-sunken)",
                      color: status.enabled ? "var(--success)" : "var(--text-tertiary)",
                      border: `1px solid ${status.enabled ? "var(--success)" : "var(--border)"}`,
                      borderRadius: "var(--r-md)", cursor: "pointer",
                    }}
                  >
                    {status.enabled ? "On" : "Off"}
                  </button>
                </div>
              </div>

              {/* Test result */}
              {testResult && (
                <div style={{
                  padding: "8px 12px", borderRadius: "var(--r-md)", marginBottom: 12, fontSize: "0.75rem",
                  background: testResult.success ? "var(--success-bg)" : "var(--error-bg)",
                  color: testResult.success ? "var(--success)" : "var(--error)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span>
                    {testResult.success
                      ? `Connected to ${testResult.model} in ${testResult.latencyMs}ms`
                      : testResult.error}
                  </span>
                  <span style={{ fontSize: "0.6875rem", opacity: 0.7 }}>
                    via {testResult.credentialSource}
                  </span>
                </div>
              )}

              {/* Models */}
              {provider && provider.models.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {provider.models.map((model) => (
                    <div key={model.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 14px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                          background: model.enabled ? "var(--success)" : "var(--border-strong)",
                        }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: "0.8125rem", fontWeight: 500 }}>{model.name}</p>
                          <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                            {(model.context_window / 1000).toFixed(0)}K ctx · ${model.input_price}/${model.output_price} per 1M tokens
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        {model.capabilities && model.capabilities.length > 0 && (
                          <div style={{ display: "flex", gap: 4 }}>
                            {model.capabilities.slice(0, 3).map((cap) => (
                              <span key={cap} style={{
                                fontSize: "0.5625rem", padding: "1px 5px", borderRadius: 4,
                                background: "var(--accent-bg)", color: "var(--accent)",
                              }}>{cap}</span>
                            ))}
                            {model.capabilities.length > 3 && (
                              <span style={{ fontSize: "0.5625rem", color: "var(--text-tertiary)" }}>
                                +{model.capabilities.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => toggleModel(model.id, !model.enabled)}
                          style={{
                            padding: "3px 10px", fontSize: "0.6875rem", fontWeight: 500,
                            background: model.enabled ? "var(--success-bg)" : "var(--bg-card)",
                            color: model.enabled ? "var(--success)" : "var(--text-tertiary)",
                            border: `1px solid ${model.enabled ? "var(--success)" : "var(--border)"}`,
                            borderRadius: 9999, cursor: "pointer",
                          }}
                        >
                          {model.enabled ? "On" : "Off"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {provider && provider.models.length === 0 && (
                <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>No models configured</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
