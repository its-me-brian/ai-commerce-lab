"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

interface Agent {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface TestResult {
  success: boolean;
  data?: Record<string, unknown>;
  output?: string;
  reasoningSummary?: string;
  errors?: string[];
  metadata?: Record<string, unknown>;
  error?: string;
}

interface TestHistoryEntry {
  id: string;
  agentId: string;
  agentName: string;
  input: string;
  result: TestResult;
  timestamp: string;
}

const AGENT_PRESETS: Record<string, string> = {
  "product-hunter": JSON.stringify({
    name: "LED Portable Lamp",
    supplierPrice: 12.40,
    shippingCost: 3.20,
    estimatedSalePrice: 49.90,
  }, null, 2),
  "market-research": JSON.stringify({
    productOrCategory: "wireless earbuds",
    targetMarket: "Europe",
    priceRange: "USD 15-50",
  }, null, 2),
  "supplier-research": JSON.stringify({
    productName: "Wireless Earbuds",
    category: "electronics",
    targetMarket: "Europe",
    orderVolume: "small (dropshipping)",
  }, null, 2),
  "opportunity-scoring": JSON.stringify({
    productAnalysis: { name: "LED Lamp", price: 49.90, category: "lighting" },
    supplierResearch: {},
    marketResearch: {},
  }, null, 2),
  "store-builder": JSON.stringify({
    goal: "Build a product page for LED Portable Lamp",
    productName: "LED Portable Lamp",
  }, null, 2),
  "marketing": JSON.stringify({
    product: "LED Portable Lamp",
    targetAudience: "EU consumers",
    channels: ["instagram", "tiktok"],
  }, null, 2),
  "secretary": JSON.stringify({
    task: "Summarize recent agent activity",
    scope: "last 24 hours",
  }, null, 2),
  "finance": JSON.stringify({
    task: "Calculate projected margins",
    product: "LED Portable Lamp",
    cost: 15.60,
    price: 49.90,
  }, null, 2),
  "ceo": JSON.stringify({
    goal: "Review product portfolio and recommend next steps",
  }, null, 2),
};

export default function TestCenterPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [testInput, setTestInput] = useState('{\n  "name": "Test Product",\n  "supplierPrice": 10\n}');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [history, setHistory] = useState<TestHistoryEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("test-center-history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);

 
  async function _fetchAgents() {
    try {
      const res = await fetch("/api/agents/list");
      const data = await res.json();
      if (data.success && data.agents) {
        setAgents(
          data.agents.map((a: { id: string; name: string; description: string; enabled: boolean }) => ({
            id: a.id,
            name: a.name,
            description: a.description,
            enabled: a.enabled,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load agents:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/agents/list");
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.agents) {
          setAgents(
            data.agents.map((a: { id: string; name: string; description: string; enabled: boolean }) => ({
              id: a.id,
              name: a.name,
              description: a.description,
              enabled: a.enabled,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load agents:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function selectAgent(agentId: string) {
    setSelectedAgent(agentId);
    setTestInput(AGENT_PRESETS[agentId] || '{\n  "input": "test"\n}');
    setResult(null);
  }

  async function runTest() {
    if (!selectedAgent) return;

    let input: Record<string, unknown>;
    try {
      input = JSON.parse(testInput);
    } catch {
      setResult({ success: false, error: "Invalid JSON input" });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgent, input }),
      });
      const data = await res.json();
      setResult(data);

      // Add to history
      const agent = agents.find(a => a.id === selectedAgent);
      const entry: TestHistoryEntry = {
        id: Date.now().toString(),
        agentId: selectedAgent,
        agentName: agent?.name || selectedAgent,
        input: testInput,
        result: data,
        timestamp: new Date().toISOString(),
      };
      const newHistory = [entry, ...history].slice(0, 20);
      setHistory(newHistory);
      localStorage.setItem("test-center-history", JSON.stringify(newHistory));
    } catch {
      setResult({ success: false, error: "Network error" });
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

  return (
    <div className="page-padding" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Test Center</h1>
        <p>Test any agent with custom input and view results</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="config-grid">
        {/* Left: Input */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Agent selector */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
            <h2 style={{ marginBottom: 12 }}>Select Agent</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => selectAgent(agent.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", background: selectedAgent === agent.id ? "var(--accent-light)" : "var(--bg-sunken)",
                    border: `1px solid ${selectedAgent === agent.id ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: "var(--r-md)", cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                    background: selectedAgent === agent.id ? "var(--accent)" : "var(--text-tertiary)",
                  }} />
                  <div>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: selectedAgent === agent.id ? "var(--accent)" : "var(--text-primary)" }}>
                      {agent.name}
                    </p>
                    <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>{agent.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
            <h2 style={{ marginBottom: 12 }}>Input (JSON)</h2>
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              rows={12}
              className="mono"
              aria-label="Test input JSON"
              style={{
                width: "100%", padding: "10px 14px", border: "1px solid var(--border)",
                borderRadius: "var(--r-md)", fontSize: "0.75rem", background: "var(--bg-card)",
                resize: "vertical", lineHeight: 1.5,
              }}
            />
            <Button
              onClick={runTest}
              loading={testing}
              disabled={!selectedAgent}
              className="w-full mt-3"
            >
              Run Test
            </Button>
          </div>
        </div>

        {/* Right: Results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {result ? (
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)", padding: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2>Result</h2>
                <span style={{
                  fontSize: "0.6875rem", fontWeight: 500, padding: "2px 8px", borderRadius: 9999,
                  background: result.success ? "var(--success-bg)" : "var(--error-bg)",
                  color: result.success ? "var(--success)" : "var(--error)",
                }}>
                  {result.success ? "Success" : "Error"}
                </span>
              </div>

              {result.success ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <pre className="mono" style={{
                    fontSize: "0.75rem", background: "var(--bg-sunken)", padding: 12,
                    borderRadius: "var(--r-md)", overflow: "auto", maxHeight: 400, lineHeight: 1.5,
                  }}>
                    {JSON.stringify(result.data || result.output || result, null, 2)}
                  </pre>

                  {result.metadata && (
                    <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                      Model: {(result.metadata as Record<string, unknown>).modelUsed as string} · {" "}
                      {((result.metadata as Record<string, unknown>).inputTokens as number) + ((result.metadata as Record<string, unknown>).outputTokens as number)} tokens · {" "}
                      {(((result.metadata as Record<string, unknown>).durationMs as number) / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "0.8125rem", color: "var(--error)" }}>{result.error}</p>
              )}
            </div>
          ) : (
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
            }}>
              <EmptyState
                icon="🧪"
                title="Select an agent"
                description="Choose an agent and click Run Test to see results."
              />
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: 20, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Recent Tests</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map((entry) => (
              <div
                key={entry.id}
                onClick={() => {
                  setSelectedAgent(entry.agentId);
                  setTestInput(entry.input);
                  setResult(entry.result);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedAgent(entry.agentId);
                    setTestInput(entry.input);
                    setResult(entry.result);
                  }
                }}
                role="button"
                tabIndex={0}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", background: "var(--bg-sunken)", borderRadius: "var(--r-md)",
                  fontSize: "0.75rem", cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: entry.result.success ? "var(--success)" : "var(--error)",
                  }} />
                  <span style={{ fontWeight: 500 }}>{entry.agentName}</span>
                </div>
                <span style={{ color: "var(--text-tertiary)" }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
