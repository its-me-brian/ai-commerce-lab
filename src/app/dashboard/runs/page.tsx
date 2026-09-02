import { supabase } from "@/lib/database/supabase";

export const metadata = { title: "Run History — AI Commerce Lab" };

export default async function RunsPage() {
  const { data: runs } = await supabase
    .from("agent_runs")
    .select("id, agent_id, provider, model, input_tokens, output_tokens, total_tokens, duration_ms, cost, status, error, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="page-padding" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Run History</h1>
        <p>All agent executions with status, tokens, and cost</p>
      </div>

      {runs && runs.length > 0 ? (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.6875rem" }}>Status</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.6875rem" }}>Agent</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.6875rem" }}>Provider</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.6875rem" }}>Model</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.6875rem" }}>Tokens</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.6875rem" }}>Duration</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.6875rem" }}>Cost</th>
                <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.6875rem" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <a href={`/dashboard/runs/${run.id}`} style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: run.status === "completed" ? "var(--success)" : run.status === "failed" ? "var(--error)" : "var(--text-tertiary)",
                      }} />
                      <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{run.status}</span>
                    </a>
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 500 }}>
                    <a href={`/dashboard/runs/${run.id}`} style={{ textDecoration: "none", color: "var(--text-primary)" }}>{run.agent_id}</a>
                  </td>
                  <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{run.provider}</td>
                  <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }} className="mono">{run.model}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "var(--text-secondary)" }}>{(run.total_tokens || 0).toLocaleString()}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "var(--text-secondary)" }}>{(run.duration_ms / 1000).toFixed(1)}s</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "var(--text-secondary)" }}>{run.cost > 0 ? `$${run.cost.toFixed(4)}` : "—"}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", color: "var(--text-tertiary)" }}>
                    {new Date(run.created_at).toLocaleDateString()} {new Date(run.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 40, textAlign: "center" }}>
          <p style={{ fontSize: "0.875rem", fontWeight: 500, marginBottom: 4 }}>No runs yet</p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            Run an agent from the <a href="/dashboard/agents" style={{ color: "var(--accent)" }}>Agents</a> page to see execution history here.
          </p>
        </div>
      )}
    </div>
  );
}
