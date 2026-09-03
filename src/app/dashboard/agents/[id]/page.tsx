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
  source: "ebay",
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
    output?: string;
    reasoningSummary?: string;
    errors?: string[];
    metadata?: Record<string, unknown>;
    error?: string;
  } | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Workspace state
  const [memory, setMemory] = useState<Array<{ id: string; key: string; value: string; created_at: string }>>([]);
  const [handoffs, setHandoffs] = useState<Array<{ id: string; from_agent_id: string; to_agent_id: string; status: string; created_at: string }>>([]);
  const [approvals, setApprovals] = useState<Array<{ id: string; task_id: string; status: string; risk_level: string; created_at: string }>>([]);
  const [events, setEvents] = useState<Array<{ id: string; task_id: string; event_type: string; description: string; created_at: string }>>([]);

  // Model routes state
  interface ModelRoute {
    id: string;
    model_id: string;
    priority: number;
    policy: string;
    enabled: boolean;
    ai_models: {
      name: string;
      model_id: string;
      provider_id: string;
      context_window: number;
      input_price: number;
      output_price: number;
      capabilities: string[];
      ai_providers: { name: string; slug: string };
    };
  }
  const [modelRoutes, setModelRoutes] = useState<ModelRoute[]>([]);
  const [addingRoute, setAddingRoute] = useState(false);
  const [newRouteModelId, setNewRouteModelId] = useState("");
  const [newRoutePriority, setNewRoutePriority] = useState(1);
  const [newRoutePolicy, setNewRoutePolicy] = useState("preferred");

  // Form state
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [fallbackProvider, setFallbackProvider] = useState("");
  const [fallbackModel, setFallbackModel] = useState("");
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(4096);

  // Profile edit state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");

  // Definition edit state
  const [editingDefinition, setEditingDefinition] = useState(false);
  const [defIdentityName, setDefIdentityName] = useState("");
  const [defIdentityRole, setDefIdentityRole] = useState("");
  const [defIdentityDescription, setDefIdentityDescription] = useState("");
  const [defMission, setDefMission] = useState("");
  const [defExpertise, setDefExpertise] = useState("");
  const [defRules, setDefRules] = useState("");

  // Test form — generic JSON input
  const [testInput, setTestInput] = useState(
    DEFAULT_TEST_INPUTS[id] || '{\n  "name": "Test Product",\n  "supplierPrice": 10\n}'
  );
  const [testInputError, setTestInputError] = useState("");
  const [searchMode, setSearchMode] = useState<"analyze" | "discover">("analyze");
  const [searchSource, setSearchSource] = useState("ebay");
  const [availableSources, setAvailableSources] = useState<Array<{ id: string; name: string; configured: boolean }>>([]);

  useEffect(() => {
    fetchConfig();
    fetchSources();
    fetchWorkspace();
    setTestInput(DEFAULT_TEST_INPUTS[id] || '{\n  "name": "Test Product",\n  "supplierPrice": 10\n}');
  }, [id]);

  async function fetchConfig() {
    try {
      const res = await fetch(`/api/agents/config?agentId=${id}`);
      const data = await res.json();
      if (data.success) {
        setConfig(data);
        setProfileName(data.agent.identity?.name || data.agent.name || "");
        setProfileDescription(data.agent.identity?.description || data.agent.description || "");
        if (data.config) {
          setSelectedProvider(data.config.primary_provider_id);
          setSelectedModel(data.config.primary_model_id);
          setFallbackProvider(data.config.fallback_provider_id || "");
          setFallbackModel(data.config.fallback_model_id || "");
          setTemperature(data.config.temperature);
          setMaxTokens(data.config.max_output_tokens);
        }
      }

      // Load agent definition
      const defRes = await fetch(`/api/agents/${id}/definition`);
      const defData = await defRes.json();
      if (defData.success && defData.definition) {
        const def = defData.definition;
        setDefIdentityName(def.identity_name || "");
        setDefIdentityRole(def.identity_role || "");
        setDefIdentityDescription(def.identity_description || "");
        setDefMission(def.mission || "");
        setDefExpertise(Array.isArray(def.expertise) ? def.expertise.join(", ") : "");
        setDefRules(Array.isArray(def.rules) ? def.rules.join("\n") : "");
      }
    } catch (err) {
      console.error("Failed to load config:", err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSources() {
    try {
      const res = await fetch("/api/tools/sources");
      const data = await res.json();
      if (data.sources) {
        setAvailableSources(data.sources);
      }
    } catch (err) {
      console.error("Failed to load sources:", err);
    }
  }

  async function fetchWorkspace() {
    try {
      const [memoryRes, handoffsRes, approvalsRes, eventsRes] = await Promise.all([
        fetch(`/api/agents/${id}/memory`),
        fetch(`/api/agents/${id}/handoffs`),
        fetch(`/api/agents/${id}/approvals`),
        fetch(`/api/agents/${id}/events`),
      ]);

      const [memoryData, handoffsData, approvalsData, eventsData] = await Promise.all([
        memoryRes.json(),
        handoffsRes.json(),
        approvalsRes.json(),
        eventsRes.json(),
      ]);

      if (memoryData.success) setMemory(memoryData.memory);
      if (handoffsData.success) setHandoffs(handoffsData.handoffs);
      if (approvalsData.success) setApprovals(approvalsData.approvals);
      if (eventsData.success) setEvents(eventsData.events);
    } catch (err) {
      console.error("Failed to load workspace data:", err);
    }

    // Model routes
    try {
      const res = await fetch(`/api/agents/${id}/model-routes`);
      const data = await res.json();
      if (data.success) setModelRoutes(data.routes);
    } catch (err) {
      console.error("Failed to load model routes:", err);
    }
  }

  async function addModelRoute() {
    if (!newRouteModelId) return;
    try {
      const res = await fetch(`/api/agents/${id}/model-routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: newRouteModelId, priority: newRoutePriority, policy: newRoutePolicy }),
      });
      const data = await res.json();
      if (data.success) {
        setAddingRoute(false);
        setNewRouteModelId("");
        setNewRoutePriority(1);
        setNewRoutePolicy("preferred");
        fetchModelRoutes();
      }
    } catch (err) {
      console.error("Failed to add model route:", err);
    }
  }

  async function toggleRoute(routeId: string, enabled: boolean) {
    try {
      await fetch(`/api/agents/${id}/model-routes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId, enabled }),
      });
      fetchModelRoutes();
    } catch (err) {
      console.error("Failed to toggle route:", err);
    }
  }

  async function deleteRoute(routeId: string) {
    try {
      await fetch(`/api/agents/${id}/model-routes?routeId=${routeId}`, { method: "DELETE" });
      fetchModelRoutes();
    } catch (err) {
      console.error("Failed to delete route:", err);
    }
  }

  function fetchModelRoutes() {
    fetch(`/api/agents/${id}/model-routes`)
      .then(r => r.json())
      .then(data => { if (data.success) setModelRoutes(data.routes); })
      .catch(err => console.error("Failed to load model routes:", err));
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

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName,
          description: profileDescription,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: "Profile saved" });
        setEditingProfile(false);
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

  async function handleSaveDefinition() {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${id}/definition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity_name: defIdentityName,
          identity_role: defIdentityRole,
          identity_description: defIdentityDescription,
          mission: defMission,
          expertise: defExpertise.split(",").map((s) => s.trim()).filter(Boolean),
          rules: defRules.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: "Definition saved" });
        setEditingDefinition(false);
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
          {editingProfile ? profileName : (config.agent.identity?.name || config.agent.name)}
        </p>
        {editingProfile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 500 }}>
            <input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Agent name"
              style={{
                padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)",
                fontSize: "1.25rem", fontWeight: 600, background: "var(--bg-card)",
              }}
            />
            <textarea
              value={profileDescription}
              onChange={(e) => setProfileDescription(e.target.value)}
              placeholder="Description"
              rows={2}
              style={{
                padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)",
                fontSize: "0.875rem", background: "var(--bg-card)", resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                style={{
                  padding: "6px 14px", background: "var(--accent)", color: "white",
                  border: "none", borderRadius: "var(--r-md)", fontSize: "0.8125rem",
                  fontWeight: 500, cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingProfile(false);
                  setProfileName(config.agent.identity?.name || config.agent.name || "");
                  setProfileDescription(config.agent.identity?.description || config.agent.description || "");
                }}
                style={{
                  padding: "6px 14px", background: "var(--bg-sunken)", color: "var(--text-secondary)",
                  border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ marginBottom: 3 }}>{config.agent.identity?.name || config.agent.name}</h1>
              <button
                onClick={() => setEditingProfile(true)}
                style={{
                  padding: "3px 10px", fontSize: "0.6875rem", fontWeight: 500,
                  background: "var(--bg-sunken)", color: "var(--text-tertiary)",
                  border: "1px solid var(--border)", borderRadius: 9999, cursor: "pointer",
                }}
              >
                Edit
              </button>
            </div>
            <p>{config.agent.identity?.role || config.agent.description}</p>
          </>
        )}
      </div>

      {/* Agent Definition (Identity, Mission, Personality, Expertise, Rules, Skills) */}
      {config.agent.identity && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2>Agent Definition</h2>
            {!editingDefinition && (
              <button
                onClick={() => setEditingDefinition(true)}
                style={{
                  fontSize: "0.75rem", padding: "4px 12px", borderRadius: "var(--r-md)",
                  background: "var(--bg-sunken)", border: "1px solid var(--border)",
                  cursor: "pointer", color: "var(--text-secondary)",
                }}
              >
                Edit Definition
              </button>
            )}
          </div>

          {editingDefinition ? (
            /* Edit Form */
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Identity Name</label>
                <input
                  value={defIdentityName}
                  onChange={(e) => setDefIdentityName(e.target.value)}
                  style={{ width: "100%", padding: "6px 10px", fontSize: "0.8125rem", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--bg-sunken)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Identity Role</label>
                <input
                  value={defIdentityRole}
                  onChange={(e) => setDefIdentityRole(e.target.value)}
                  style={{ width: "100%", padding: "6px 10px", fontSize: "0.8125rem", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--bg-sunken)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Identity Description</label>
                <textarea
                  value={defIdentityDescription}
                  onChange={(e) => setDefIdentityDescription(e.target.value)}
                  rows={3}
                  style={{ width: "100%", padding: "6px 10px", fontSize: "0.8125rem", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--bg-sunken)", resize: "vertical" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Mission</label>
                <textarea
                  value={defMission}
                  onChange={(e) => setDefMission(e.target.value)}
                  rows={3}
                  style={{ width: "100%", padding: "6px 10px", fontSize: "0.8125rem", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--bg-sunken)", resize: "vertical" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Expertise (comma-separated)</label>
                <input
                  value={defExpertise}
                  onChange={(e) => setDefExpertise(e.target.value)}
                  style={{ width: "100%", padding: "6px 10px", fontSize: "0.8125rem", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--bg-sunken)" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Rules (one per line)</label>
                <textarea
                  value={defRules}
                  onChange={(e) => setDefRules(e.target.value)}
                  rows={4}
                  style={{ width: "100%", padding: "6px 10px", fontSize: "0.8125rem", borderRadius: "var(--r-md)", border: "1px solid var(--border)", background: "var(--bg-sunken)", resize: "vertical", fontFamily: "monospace" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleSaveDefinition}
                  disabled={saving}
                  style={{
                    fontSize: "0.75rem", padding: "6px 16px", borderRadius: "var(--r-md)",
                    background: "var(--accent)", color: "white", border: "none",
                    cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? "Saving..." : "Save Definition"}
                </button>
                <button
                  onClick={() => setEditingDefinition(false)}
                  style={{
                    fontSize: "0.75rem", padding: "6px 16px", borderRadius: "var(--r-md)",
                    background: "var(--bg-sunken)", border: "1px solid var(--border)",
                    cursor: "pointer", color: "var(--text-secondary)",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Read-only View */
            <>
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
            </>
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

              <div style={{ display: "grid", gap: 12 }} className="config-grid">
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

          {/* Model Pool (Model Assignment) */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2>Model Pool</h2>
              <button
                onClick={() => setAddingRoute(!addingRoute)}
                style={{
                  padding: "4px 12px", fontSize: "0.75rem", fontWeight: 500,
                  background: addingRoute ? "var(--bg-sunken)" : "var(--accent-bg)",
                  color: addingRoute ? "var(--text-secondary)" : "var(--accent)",
                  border: "1px solid var(--border)", borderRadius: "var(--r-md)", cursor: "pointer",
                }}
              >
                {addingRoute ? "Cancel" : "+ Add Model"}
              </button>
            </div>
            <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginBottom: 12 }}>
              Models this agent can use, ordered by priority. Higher priority = tried first.
            </p>

            {/* Add model form */}
            {addingRoute && (
              <div style={{
                padding: 12, background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
                marginBottom: 12, display: "flex", flexDirection: "column", gap: 8,
              }}>
                <select
                  value={newRouteModelId}
                  onChange={(e) => setNewRouteModelId(e.target.value)}
                  style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.75rem", background: "var(--bg-card)" }}
                >
                  <option value="">Select a model...</option>
                  {config?.models.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginBottom: 2, display: "block" }}>Priority</label>
                    <input
                      type="number"
                      value={newRoutePriority}
                      onChange={(e) => setNewRoutePriority(parseInt(e.target.value))}
                      min={1}
                      max={100}
                      style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.75rem", background: "var(--bg-card)" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginBottom: 2, display: "block" }}>Policy</label>
                    <select
                      value={newRoutePolicy}
                      onChange={(e) => setNewRoutePolicy(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", fontSize: "0.75rem", background: "var(--bg-card)" }}
                    >
                      <option value="preferred">Preferred</option>
                      <option value="fallback">Fallback</option>
                      <option value="required">Required</option>
                      <option value="excluded">Excluded</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={addModelRoute}
                  disabled={!newRouteModelId}
                  style={{
                    padding: "6px 12px", fontSize: "0.75rem", fontWeight: 500,
                    background: newRouteModelId ? "var(--accent)" : "var(--bg-sunken)",
                    color: "white", border: "none", borderRadius: "var(--r-md)",
                    cursor: newRouteModelId ? "pointer" : "not-allowed",
                    opacity: newRouteModelId ? 1 : 0.5,
                  }}
                >
                  Add to Pool
                </button>
              </div>
            )}

            {/* Route list */}
            {modelRoutes.length === 0 ? (
              <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>No models in pool</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {modelRoutes.map((route) => (
                  <div key={route.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
                    fontSize: "0.75rem", opacity: route.enabled ? 1 : 0.5,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{
                        fontSize: "0.625rem", fontWeight: 600, padding: "1px 5px", borderRadius: 4,
                        background: "var(--accent-bg)", color: "var(--accent)", minWidth: 20, textAlign: "center",
                      }}>P{route.priority}</span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 500 }}>{route.ai_models.name}</p>
                        <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                          {route.ai_models.ai_providers.name} · {(route.ai_models.context_window / 1000).toFixed(0)}K ctx · ${route.ai_models.input_price}/${route.ai_models.output_price}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{
                        fontSize: "0.5625rem", padding: "1px 5px", borderRadius: 4,
                        background: route.policy === "preferred" ? "var(--success-bg)" : "var(--bg-card)",
                        color: route.policy === "preferred" ? "var(--success)" : "var(--text-tertiary)",
                      }}>{route.policy}</span>
                      <button
                        onClick={() => toggleRoute(route.id, !route.enabled)}
                        style={{
                          padding: "2px 8px", fontSize: "0.6875rem", fontWeight: 500,
                          background: route.enabled ? "var(--success-bg)" : "var(--bg-card)",
                          color: route.enabled ? "var(--success)" : "var(--text-tertiary)",
                          border: `1px solid ${route.enabled ? "var(--success)" : "var(--border)"}`,
                          borderRadius: 9999, cursor: "pointer",
                        }}
                      >
                        {route.enabled ? "On" : "Off"}
                      </button>
                      <button
                        onClick={() => deleteRoute(route.id)}
                        style={{
                          padding: "2px 6px", fontSize: "0.6875rem",
                          background: "none", color: "var(--text-tertiary)",
                          border: "none", cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                ? (searchMode === "discover" ? "Search and analyze products" : "Analyze a product opportunity")
                : `Send input to ${config.agent.name}`}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Product Hunter: Mode + Source selectors */}
              {isProductHunter && (
                <div style={{ display: "grid", gridTemplateColumns: searchMode === "discover" ? "1fr 1fr" : "1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, marginBottom: 4 }}>Mode</label>
                    <select
                      value={searchMode}
                      onChange={(e) => {
                        const mode = e.target.value as "analyze" | "discover";
                        setSearchMode(mode);
                        if (mode === "discover") {
                          setTestInput(DISCOVER_TEST_INPUT.replace('"ebay"', `"${searchSource}"`));
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
                        {availableSources.length > 0 ? (
                          availableSources.map((s) => (
                            <option key={s.id} value={s.id} disabled={!s.configured}>
                              {s.name}{!s.configured ? " (not configured)" : ""}
                            </option>
                          ))
                        ) : (
                          <option value="ebay">eBay Products</option>
                        )}
                      </select>
                    </div>
                  )}
                </div>
              )}
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
              {/* Discover mode: Multiple opportunities */}
              {isProductHunter && testResult.data && typeof testResult.data === "object" && "opportunities" in testResult.data ? (
                <DiscoverResults data={testResult.data as Record<string, unknown>} errors={testResult.errors} />
              ) : isProductHunter && testResult.data && typeof testResult.data === "object" && "score" in testResult.data ? (
                /* Analyze mode: Single product analysis */
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
                      {(testResult.data as Record<string, unknown>).score as number}
                    </span>
                    <span style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>/100</span>
                  </div>

                  <span style={{
                    fontSize: "0.75rem", fontWeight: 500, padding: "4px 10px", borderRadius: 9999, width: "fit-content",
                    background: getRecommendationColor((testResult.data as Record<string, unknown>).recommendation as string),
                  }}>
                    {(testResult.data as Record<string, unknown>).recommendation as string}
                  </span>

                  <div style={{ display: "grid", gap: 8 }} className="config-grid">
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

      {/* Workspace Sections */}
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Memory */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Memory</h2>
          {memory.length === 0 ? (
            <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>No memory entries yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {memory.map((m) => (
                <div key={m.id} style={{
                  padding: "8px 12px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
                  fontSize: "0.75rem", display: "flex", justifyContent: "space-between",
                }}>
                  <span style={{ fontWeight: 500 }}>{m.key}</span>
                  <span style={{ color: "var(--text-tertiary)" }}>{m.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Handoffs */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Handoff History</h2>
          {handoffs.length === 0 ? (
            <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>No handoffs yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {handoffs.map((h) => (
                <div key={h.id} style={{
                  padding: "8px 12px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
                  fontSize: "0.75rem", display: "flex", justifyContent: "space-between",
                }}>
                  <span style={{ fontWeight: 500 }}>{h.from_agent_id} → {h.to_agent_id}</span>
                  <span style={{
                    fontSize: "0.6875rem", padding: "2px 8px", borderRadius: 9999,
                    background: h.status === "completed" ? "var(--success-bg)" : "var(--bg-sunken)",
                    color: h.status === "completed" ? "var(--success)" : "var(--text-tertiary)",
                  }}>{h.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Approvals */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Approvals</h2>
          {approvals.length === 0 ? (
            <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>No approvals yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {approvals.map((a) => (
                <div key={a.id} style={{
                  padding: "8px 12px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
                  fontSize: "0.75rem", display: "flex", justifyContent: "space-between",
                }}>
                  <span style={{ fontWeight: 500 }}>Task: {a.task_id.slice(0, 8)}...</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: "0.6875rem", padding: "2px 8px", borderRadius: 9999,
                      background: a.risk_level === "critical" ? "var(--error-bg)" : "var(--warning-bg, #fef3c7)",
                      color: a.risk_level === "critical" ? "var(--error)" : "var(--warning, #d97706)",
                    }}>{a.risk_level}</span>
                    <span style={{
                      fontSize: "0.6875rem", padding: "2px 8px", borderRadius: 9999,
                      background: a.status === "approved" ? "var(--success-bg)" : "var(--bg-sunken)",
                      color: a.status === "approved" ? "var(--success)" : "var(--text-tertiary)",
                    }}>{a.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Task History / Audit Trail */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Task History</h2>
          {events.length === 0 ? (
            <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>No events yet</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {events.map((e) => (
                <div key={e.id} style={{
                  padding: "8px 12px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
                  fontSize: "0.75rem",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontWeight: 500 }}>{e.event_type}</span>
                    <span style={{ color: "var(--text-tertiary)", fontSize: "0.6875rem" }}>
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>{e.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function getRecommendationColor(rec: string): string {
  switch (rec) {
    case "APPROVE": return "var(--success-bg)";
    case "INVESTIGATE": return "var(--accent-bg)";
    case "NEEDS_MORE_DATA": return "var(--warning-bg, #fef3c7)";
    case "REJECT": return "var(--error-bg)";
    default: return "var(--bg-sunken)";
  }
}

function getRecommendationTextColor(rec: string): string {
  switch (rec) {
    case "APPROVE": return "var(--success)";
    case "INVESTIGATE": return "var(--accent)";
    case "NEEDS_MORE_DATA": return "var(--warning, #d97706)";
    case "REJECT": return "var(--error)";
    default: return "var(--text-secondary)";
  }
}

function ConfidenceBadge({ level }: { level: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    KNOWN: { bg: "var(--success-bg)", text: "var(--success)" },
    ESTIMATED: { bg: "var(--accent-bg)", text: "var(--accent)" },
    UNKNOWN: { bg: "var(--bg-sunken)", text: "var(--text-tertiary)" },
  };
  const c = colors[level] || colors.UNKNOWN;
  return (
    <span style={{
      fontSize: "0.5625rem", fontWeight: 600, padding: "1px 5px", borderRadius: 4,
      background: c.bg, color: c.text, textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {level}
    </span>
  );
}

function DiscoverResults({ data, errors }: { data: Record<string, unknown>; errors?: string[] }) {
  const opportunities = (data.opportunities as Array<Record<string, unknown>>) || [];
  const totalFound = data.totalFound as number;
  const analyzedCount = data.analyzedCount as number;
  const skippedCount = data.skippedCount as number;
  const query = data.query as string;
  const source = data.source as string;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Summary header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
      }}>
        <div>
          <p style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
            {query && `"${query}"`} → {analyzedCount} opportunities found
          </p>
          <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
            {totalFound} products scanned · {source} source
            {skippedCount > 0 && ` · ${skippedCount} skipped`}
          </p>
        </div>
      </div>

      {/* Opportunity cards */}
      {opportunities.map((opp, i) => {
        const name = opp.name as string;
        const price = opp.price as number;
        const currency = opp.currency as string;
        const score = opp.score as number;
        const recommendation = opp.recommendation as string;
        const explanation = opp.explanation as string;
        const estimatedMargin = opp.estimatedMargin as number;
        const recommendedPrice = opp.recommendedPrice as number;
        const profit = opp.profit as number | undefined;
        const demandScore = opp.demandScore as number;
        const competitionScore = opp.competitionScore as number;
        const riskScore = opp.riskScore as number;
        const imageUrl = opp.imageUrl as string | undefined;
        const sourceLabel = opp.source as string;
        const dataConfidence = opp.dataConfidence as Record<string, string> | undefined;

        return (
          <div key={i} style={{
            border: "1px solid var(--border)", borderRadius: "var(--r-md)",
            padding: 14, background: "var(--bg-card)",
          }}>
            {/* Product header */}
            <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={name}
                  style={{ width: 48, height: 48, borderRadius: "var(--r-sm)", objectFit: "cover" }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                    {currency} {price.toFixed(2)}
                  </span>
                  <span style={{ fontSize: "0.625rem", color: "var(--text-tertiary)" }}>
                    via {sourceLabel}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {score}
                </p>
                <p style={{ fontSize: "0.625rem", color: "var(--text-tertiary)" }}>SCORE</p>
              </div>
            </div>

            {/* Recommendation badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <span style={{
                fontSize: "0.6875rem", fontWeight: 500, padding: "3px 8px", borderRadius: 9999,
                background: getRecommendationColor(recommendation),
                color: getRecommendationTextColor(recommendation),
              }}>
                {recommendation}
              </span>
              {profit !== undefined && (
                <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                  Profit: {currency} {profit.toFixed(2)}
                </span>
              )}
            </div>

            {/* Metrics grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10 }}>
              <MiniStat label="Margin" value={`${estimatedMargin}%`} />
              <MiniStat label="Demand" value={`${demandScore}/100`} />
              <MiniStat label="Competition" value={`${competitionScore}/100`} />
              <MiniStat label="Risk" value={`${riskScore}/100`} />
            </div>

            {/* Pricing info */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10, fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
              <span>Recommended: {currency} {recommendedPrice.toFixed(2)}</span>
              <span>·</span>
              <span>Margin: {estimatedMargin.toFixed(1)}%</span>
            </div>

            {/* Data confidence */}
            {dataConfidence && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{ fontSize: "0.625rem", color: "var(--text-tertiary)" }}>Data:</span>
                {Object.entries(dataConfidence).map(([key, level]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <span style={{ fontSize: "0.625rem", color: "var(--text-tertiary)" }}>{key}:</span>
                    <ConfidenceBadge level={level as string} />
                  </div>
                ))}
              </div>
            )}

            {/* Explanation */}
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {explanation}
            </p>
          </div>
        );
      })}

      {opportunities.length === 0 && (
        <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", textAlign: "center", padding: 20 }}>
          No opportunities found. Try different search criteria.
        </p>
      )}

      {/* Errors */}
      {errors && errors.length > 0 && (
        <div style={{
          padding: "10px 14px", background: "var(--error-bg)", borderRadius: "var(--r-md)",
          border: "1px solid var(--error)",
        }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--error)", marginBottom: 4 }}>
            {errors.length} product(s) failed analysis
          </p>
          {errors.slice(0, 3).map((err, i) => (
            <p key={i} style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>{err}</p>
          ))}
          {errors.length > 3 && (
            <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
              ...and {errors.length - 3} more
            </p>
          )}
        </div>
      )}
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
