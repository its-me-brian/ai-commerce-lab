"use client";

import { useEffect, useState } from "react";

interface Budget {
  id: string;
  entityId: string;
  entityType: string;
  maxDollars: number;
  window: string;
  active: boolean;
  description?: string;
}

interface BudgetStatus {
  budget: Budget;
  currentSpending: number;
  remainingDollars: number;
  utilizationPercent: number;
  exhausted: boolean;
}

function utilizationColor(pct: number): string {
  if (pct >= 1) return "var(--error)";
  if (pct >= 0.8) return "var(--warning, #d97706)";
  if (pct >= 0.5) return "#eab308";
  return "var(--accent)";
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [statuses, setStatuses] = useState<BudgetStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/budgets?action=list");
      const data = await res.json();
      if (data.success) setBudgets(data.budgets);

      const entities = [...new Set(data.budgets.map((b: Budget) => `${b.entityType}:${b.entityId}`))];
      const statusResults = await Promise.all(
        entities.map(async (key: string) => {
          const [type, id] = key.split(":");
          const r = await fetch(`/api/ai/budgets?action=status&entityId=${id}&entityType=${type}`);
          const d = await r.json();
          return d.success ? d.statuses : [];
        })
      );
      setStatuses(statusResults.flat());
    } catch (err) {
      console.error("Failed to load budgets:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-padding" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Cost Budgets</h1>
        <p>Spending limits per agent, workflow, and globally</p>
      </div>

      {loading ? (
        <p style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)" }}>Loading budgets...</p>
      ) : budgets.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center",
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)",
        }}>
          <p style={{ fontSize: "0.875rem", color: "var(--text-tertiary)" }}>No budgets configured</p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 4 }}>
            Create budgets via the API to set spending limits
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            {statuses.map((status) => {
              const pct = Math.min(status.utilizationPercent, 1);
              const barColor = utilizationColor(status.utilizationPercent);
              return (
                <div key={status.budget.id} style={{
                  padding: "14px 16px", background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: "var(--r-lg)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <p style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                        {status.budget.entityId}
                        <span style={{
                          marginLeft: 6, fontSize: "0.5625rem", fontWeight: 600, padding: "1px 5px", borderRadius: 4,
                          background: "var(--bg-sunken)", color: "var(--text-tertiary)", textTransform: "uppercase",
                        }}>
                          {status.budget.entityType}
                        </span>
                      </p>
                      <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>
                        {status.budget.window} · Max ${status.budget.maxDollars.toFixed(2)}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                        <span style={{ color: barColor }}>${status.currentSpending.toFixed(4)}</span>
                        {" / "}
                        <span style={{ color: "var(--text-tertiary)" }}>${status.budget.maxDollars.toFixed(4)}</span>
                      </p>
                      {status.exhausted && (
                        <p style={{ fontSize: "0.5625rem", color: "var(--error)", fontWeight: 600 }}>EXHAUSTED</p>
                      )}
                    </div>
                  </div>
                  <div style={{
                    height: 6, background: "var(--bg-sunken)", borderRadius: 3, overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${pct * 100}%`, height: "100%", background: barColor,
                      borderRadius: 3, transition: "width 300ms ease",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)", overflow: "hidden",
          }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
              <h3 style={{ fontSize: "0.8125rem", fontWeight: 600 }}>All Budgets ({budgets.length})</h3>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 500, color: "var(--text-tertiary)" }}>ID</th>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 500, color: "var(--text-tertiary)" }}>Entity</th>
                  <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 500, color: "var(--text-tertiary)" }}>Window</th>
                  <th style={{ padding: "8px 14px", textAlign: "right", fontWeight: 500, color: "var(--text-tertiary)" }}>Limit</th>
                  <th style={{ padding: "8px 14px", textAlign: "center", fontWeight: 500, color: "var(--text-tertiary)" }}>Active</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "8px 14px", fontFamily: "monospace", fontSize: "0.6875rem" }}>{b.id}</td>
                    <td style={{ padding: "8px 14px" }}>
                      {b.entityId} <span style={{ color: "var(--text-tertiary)", fontSize: "0.625rem" }}>({b.entityType})</span>
                    </td>
                    <td style={{ padding: "8px 14px" }}>{b.window}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 600 }}>${b.maxDollars.toFixed(2)}</td>
                    <td style={{ padding: "8px 14px", textAlign: "center" }}>
                      <span style={{ color: b.active ? "var(--accent)" : "var(--text-tertiary)" }}>{b.active ? "\u25CF" : "\u25CB"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
