"use client";

import { useEffect, useState } from "react";

interface Evaluation {
  id: string;
  overallScore: number;
  signals: Array<{ name: string; score: number; weight?: number; explanation?: string }>;
  metrics: { durationMs: number; costDollars: number; success: boolean; retries: number };
  passed: boolean;
  timestamp: number;
}

interface Aggregated {
  totalExecutions: number;
  averageScore: number;
  scoreDistribution: { excellent: number; good: number; fair: number; poor: number };
  avgMetrics: { durationMs: number; costDollars: number; successRate: number; retryRate: number };
  signalAverages: Record<string, number>;
  trend: "improving" | "stable" | "degrading";
}

const SCORE_COLOR = (score: number) =>
  score >= 0.8 ? "var(--accent)" : score >= 0.6 ? "var(--warning, #d97706)" : "var(--error)";

export default function EvaluationPage() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [aggregated, setAggregated] = useState<Aggregated | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [evalRes, aggRes] = await Promise.all([
        fetch("/api/ai/evaluation?action=recent&count=50"),
        fetch("/api/ai/evaluation?action=aggregated"),
      ]);
      const evalData = await evalRes.json();
      const aggData = await aggRes.json();
      if (evalData.success) setEvaluations(evalData.evaluations);
      if (aggData.success) setAggregated(aggData.aggregated);
    } catch (err) {
      console.error("Failed to load evaluations:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-padding" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Evaluation Engine</h1>
        <p>Quality scoring and performance tracking for mini-IAs and workflows</p>
      </div>

      {/* Summary cards */}
      {aggregated && (
        <div className="stats-grid" style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total Executions", value: aggregated.totalExecutions },
            { label: "Average Score", value: aggregated.averageScore.toFixed(3), color: SCORE_COLOR(aggregated.averageScore) },
            { label: "Success Rate", value: `${(aggregated.avgMetrics.successRate * 100).toFixed(0)}%` },
            { label: "Trend", value: aggregated.trend, color: aggregated.trend === "improving" ? "var(--accent)" : aggregated.trend === "degrading" ? "var(--error)" : "var(--text-tertiary)" },
          ].map((card) => (
            <div key={card.label} style={{
              padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
            }}>
              <p style={{ fontSize: "0.625rem", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                {card.label}
              </p>
              <p style={{ fontSize: "1.25rem", fontWeight: 700, color: card.color || "var(--text-primary)" }}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Score distribution */}
      {aggregated && (
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)", padding: 16, marginBottom: 20,
        }}>
          <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 12 }}>Score Distribution</h3>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 60 }}>
            {([
              { label: "Excellent", count: aggregated.scoreDistribution.excellent, color: "var(--accent)" },
              { label: "Good", count: aggregated.scoreDistribution.good, color: "var(--accent, #6366f1)" },
              { label: "Fair", count: aggregated.scoreDistribution.fair, color: "var(--warning, #d97706)" },
              { label: "Poor", count: aggregated.scoreDistribution.poor, color: "var(--error)" },
            ]).map(({ label, count, color }) => {
              const max = Math.max(aggregated.scoreDistribution.excellent, aggregated.scoreDistribution.good, aggregated.scoreDistribution.fair, aggregated.scoreDistribution.poor, 1);
              return (
                <div key={label} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{
                    height: `${(count / max) * 50}px`,
                    background: color,
                    borderRadius: "3px 3px 0 0",
                    minHeight: 2,
                  }} />
                  <p style={{ fontSize: "0.5625rem", color: "var(--text-tertiary)", marginTop: 4 }}>{label}</p>
                  <p style={{ fontSize: "0.625rem", fontWeight: 600 }}>{count}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Evaluation list */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden",
      }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
          <h3 style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Recent Evaluations</h3>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>Loading...</p>
          </div>
        ) : evaluations.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>No evaluations yet</p>
          </div>
        ) : (
          <div>
            {evaluations.map((ev, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px",
                borderBottom: "1px solid var(--border-subtle)",
              }}>
                <span style={{
                  fontSize: "0.5625rem", fontWeight: 600, padding: "1px 5px", borderRadius: 4,
                  background: ev.passed ? "var(--accent-bg)" : "var(--error-bg)",
                  color: ev.passed ? "var(--accent)" : "var(--error)",
                  textTransform: "uppercase",
                }}>{ev.passed ? "PASS" : "FAIL"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                    Score: {ev.overallScore.toFixed(3)}
                  </p>
                  <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                    {ev.metrics.durationMs}ms · ${ev.metrics.costDollars.toFixed(4)} · {ev.metrics.success ? "OK" : "FAIL"}
                  </p>
                </div>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", flexShrink: 0 }}>
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
