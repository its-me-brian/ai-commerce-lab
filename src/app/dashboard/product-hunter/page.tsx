"use client";

import { useState } from "react";

type Mode = "analyze" | "discover";

interface AnalysisResult {
  score: number;
  estimatedMargin: number;
  recommendedPrice: number;
  demandScore: number;
  competitionScore: number;
  supplierScore: number;
  riskScore: number;
  recommendation: string;
  explanation: string;
}

interface DiscoverResult {
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
  url?: string;
  category?: string;
  score?: number;
  decision?: string;
}

export default function ProductHunterPage() {
  const [mode, setMode] = useState<Mode>("discover");
  const [query, setQuery] = useState("");
  const [productName, setProductName] = useState("");
  const [supplierPrice, setSupplierPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [discoverResults, setDiscoverResults] = useState<DiscoverResult[]>([]);
  const [rawResponse, setRawResponse] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!productName.trim() || !supplierPrice.trim()) return;
    setLoading(true);
    setError(null);
    setAnalysisResult(null);
    setRawResponse(null);

    try {
      const res = await fetch("/api/agents/product-hunter/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "analyze",
          name: productName.trim(),
          supplierPrice: parseFloat(supplierPrice),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Analysis failed");
      }

      if (data.data) {
        setAnalysisResult(data.data);
      } else if (data.metadata?.rawResponse) {
        setRawResponse(data.metadata.rawResponse);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleDiscover = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setDiscoverResults([]);
    setRawResponse(null);

    try {
      const res = await fetch("/api/products/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), mode: "discover" }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Discovery failed");
      }

      if (data.products?.length > 0) {
        setDiscoverResults(data.products);
      } else if (data.response?.content) {
        setRawResponse(data.response.content);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-padding" style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Product Hunter</h1>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>
          Discover and analyze ecommerce product opportunities
        </p>
      </div>

      {/* Mode Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-sunken)", borderRadius: "var(--r-md)", padding: 3 }}>
        <button
          onClick={() => setMode("discover")}
          style={{
            flex: 1, padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", cursor: "pointer",
            fontSize: "0.8125rem", fontWeight: 500,
            background: mode === "discover" ? "var(--bg-card)" : "transparent",
            color: mode === "discover" ? "var(--text-primary)" : "var(--text-tertiary)",
            boxShadow: mode === "discover" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          }}
        >
          Discover
        </button>
        <button
          onClick={() => setMode("analyze")}
          style={{
            flex: 1, padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", cursor: "pointer",
            fontSize: "0.8125rem", fontWeight: 500,
            background: mode === "analyze" ? "var(--bg-card)" : "transparent",
            color: mode === "analyze" ? "var(--text-primary)" : "var(--text-tertiary)",
            boxShadow: mode === "analyze" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          }}
        >
          Analyze
        </button>
      </div>

      {/* Input Form */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20, marginBottom: 20,
      }}>
        {mode === "discover" ? (
          <>
            <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Search Query
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDiscover()}
                placeholder="e.g. wireless earbuds, kitchen gadget, pet accessory..."
                style={{
                  flex: 1, padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)",
                  background: "var(--bg-sunken)", fontSize: "0.8125rem", color: "var(--text-primary)", outline: "none",
                }}
              />
              <button
                onClick={handleDiscover}
                disabled={loading || !query.trim()}
                style={{
                  padding: "10px 20px", borderRadius: "var(--r-md)", border: "none", cursor: loading ? "wait" : "pointer",
                  background: "var(--accent)", color: "#fff", fontSize: "0.8125rem", fontWeight: 600,
                  opacity: loading || !query.trim() ? 0.5 : 1,
                }}
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
            <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 8 }}>
              Searches eBay for products and runs multi-agent analysis
            </p>
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 8 }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Product Name
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder="e.g. Sony WH-1000XM5"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)",
                    background: "var(--bg-sunken)", fontSize: "0.8125rem", color: "var(--text-primary)", outline: "none",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                  Supplier Price
                </label>
                <input
                  type="number"
                  value={supplierPrice}
                  onChange={(e) => setSupplierPrice(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)",
                    background: "var(--bg-sunken)", fontSize: "0.8125rem", color: "var(--text-primary)", outline: "none",
                  }}
                />
              </div>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !productName.trim() || !supplierPrice.trim()}
              style={{
                marginTop: 12, padding: "10px 20px", borderRadius: "var(--r-md)", border: "none", cursor: loading ? "wait" : "pointer",
                background: "var(--accent)", color: "#fff", fontSize: "0.8125rem", fontWeight: 600,
                opacity: loading || !productName.trim() || !supplierPrice.trim() ? 0.5 : 1,
              }}
            >
              {loading ? "Analyzing..." : "Analyze Product"}
            </button>
            <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 8 }}>
              Evaluates viability, margins, and generates a recommendation score
            </p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r-md)", fontSize: "0.8125rem",
          background: "var(--error-bg)", color: "var(--error)", border: "1px solid var(--error)",
        }}>
          {error}
        </div>
      )}

      {/* Analysis Result */}
      {analysisResult && (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ fontSize: "0.875rem", fontWeight: 600 }}>Analysis Result</h2>
            <span style={{
              fontSize: "0.6875rem", fontWeight: 700, padding: "3px 10px", borderRadius: 9999,
              background: analysisResult.recommendation === "APPROVE" ? "var(--success-bg)" :
                          analysisResult.recommendation === "REJECT" ? "var(--error-bg)" : "var(--warning-bg)",
              color: analysisResult.recommendation === "APPROVE" ? "var(--success)" :
                     analysisResult.recommendation === "REJECT" ? "var(--error)" : "var(--warning)",
            }}>
              {analysisResult.recommendation}
            </span>
          </div>

          {/* Score */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginBottom: 4 }}>Overall Score</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {analysisResult.score}/100
            </div>
          </div>

          {/* Sub-scores grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "Demand", value: analysisResult.demandScore },
              { label: "Competition", value: analysisResult.competitionScore },
              { label: "Supplier", value: analysisResult.supplierScore },
              { label: "Risk", value: analysisResult.riskScore },
            ].map((s) => (
              <div key={s.label} style={{ padding: "8px 12px", borderRadius: "var(--r-md)", background: "var(--bg-sunken)" }}>
                <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>{s.label}</div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{s.value}/100</div>
              </div>
            ))}
          </div>

          {/* Financials */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div style={{ padding: "8px 12px", borderRadius: "var(--r-md)", background: "var(--bg-sunken)" }}>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>Est. Margin</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--success)" }}>
                {analysisResult.estimatedMargin > 0 ? `${(analysisResult.estimatedMargin * 100).toFixed(1)}%` : "—"}
              </div>
            </div>
            <div style={{ padding: "8px 12px", borderRadius: "var(--r-md)", background: "var(--bg-sunken)" }}>
              <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>Recommended Price</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                {analysisResult.recommendedPrice > 0 ? `€${analysisResult.recommendedPrice.toFixed(2)}` : "—"}
              </div>
            </div>
          </div>

          {/* Explanation */}
          {analysisResult.explanation && (
            <div style={{ padding: "12px", borderRadius: "var(--r-md)", background: "var(--bg-sunken)", fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {analysisResult.explanation}
            </div>
          )}
        </div>
      )}

      {/* Discover Results */}
      {discoverResults.length > 0 && (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20,
        }}>
          <h2 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: 12 }}>
            Found {discoverResults.length} product{discoverResults.length !== 1 ? "s" : ""}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {discoverResults.map((p, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                borderRadius: "var(--r-md)", background: "var(--bg-sunken)",
              }}>
                {p.imageUrl && (
                  <img src={p.imageUrl} alt="" style={{ width: 40, height: 40, borderRadius: "var(--r-sm)", objectFit: "cover" }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)" }}>{p.name}</div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                    {p.category || "—"} · {p.currency} {p.price?.toFixed(2)}
                  </div>
                </div>
                {p.decision && (
                  <span style={{
                    fontSize: "0.625rem", fontWeight: 600, padding: "2px 8px", borderRadius: 9999,
                    background: p.decision === "GO" ? "var(--success-bg)" : p.decision === "NO_GO" ? "var(--error-bg)" : "var(--warning-bg)",
                    color: p.decision === "GO" ? "var(--success)" : p.decision === "NO_GO" ? "var(--error)" : "var(--warning)",
                  }}>
                    {p.decision}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw Response */}
      {rawResponse && !analysisResult && discoverResults.length === 0 && (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20,
        }}>
          <h2 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: 8 }}>Response</h2>
          <pre style={{
            fontSize: "0.75rem", background: "var(--bg-sunken)", padding: 12, borderRadius: "var(--r-md)",
            overflow: "auto", maxHeight: 400, lineHeight: 1.5, margin: 0, color: "var(--text-secondary)",
          }}>
            {rawResponse}
          </pre>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !analysisResult && discoverResults.length === 0 && !rawResponse && (
        <div style={{
          textAlign: "center", padding: 40, color: "var(--text-tertiary)", fontSize: "0.8125rem",
        }}>
          <p style={{ fontSize: "1.5rem", marginBottom: 8 }}>🔍</p>
          <p>
            {mode === "discover"
              ? "Search for products to discover opportunities"
              : "Enter a product name and supplier price to analyze"}
          </p>
        </div>
      )}
    </div>
  );
}
