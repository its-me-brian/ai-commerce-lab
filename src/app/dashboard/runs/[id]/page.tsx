import { supabase } from "@/lib/database/supabase";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Run ${id.slice(0, 8)} — AI Commerce Lab` };
}

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Fetch run (verify workspace ownership)
  const { data: run, error: runError } = await supabase
    .from("agent_runs")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", "ws-default")
    .single();

  if (runError || !run) {
    notFound();
  }

  // Fetch associated task (verify workspace ownership)
  const { data: task } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("id", run.task_id)
    .eq("workspace_id", "ws-default")
    .single();

  return (
    <div className="page-padding" style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", marginBottom: 4 }}>
          <a href="/dashboard/runs" style={{ color: "var(--accent)", textDecoration: "none" }}>Runs</a>
          {" / "}
          <span className="mono">{id.slice(0, 8)}...</span>
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <h1 style={{ margin: 0 }}>Run Details</h1>
          <span style={{
            fontSize: "0.6875rem", fontWeight: 500, padding: "2px 10px", borderRadius: 9999,
            background: run.status === "completed" ? "var(--success-bg)" : run.status === "failed" ? "var(--error-bg)" : "var(--bg-sunken)",
            color: run.status === "completed" ? "var(--success)" : run.status === "failed" ? "var(--error)" : "var(--text-tertiary)",
          }}>
            {run.status}
          </span>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
          {new Date(run.created_at).toLocaleString()}
        </p>
      </div>

      <div style={{ display: "grid", gap: 14 }} className="config-grid">
        {/* Execution Info */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
          <h2 style={{ marginBottom: 16, fontSize: "0.875rem" }}>Execution</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <InfoRow label="Agent" value={run.agent_id} />
            <InfoRow label="Provider" value={run.provider} />
            <InfoRow label="Model" value={run.model} mono />
            <InfoRow label="Duration" value={`${(run.duration_ms / 1000).toFixed(2)}s`} />
            <InfoRow label="Started" value={run.created_at ? new Date(run.created_at).toLocaleString() : "—"} />
          </div>
        </div>

        {/* Usage */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20 }}>
          <h2 style={{ marginBottom: 16, fontSize: "0.875rem" }}>Usage</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <InfoRow label="Input Tokens" value={(run.input_tokens || 0).toLocaleString()} />
            <InfoRow label="Output Tokens" value={(run.output_tokens || 0).toLocaleString()} />
            <InfoRow label="Total Tokens" value={(run.total_tokens || 0).toLocaleString()} />
            <InfoRow label="Cost" value={run.cost > 0 ? `$${run.cost.toFixed(6)}` : "Not tracked"} />
          </div>
        </div>
      </div>

      {/* Error */}
      {run.error && (
        <div style={{ background: "var(--error-bg)", border: "1px solid var(--error)", borderRadius: "var(--r-lg)", padding: 20, marginTop: 14 }}>
          <h2 style={{ marginBottom: 8, fontSize: "0.875rem", color: "var(--error)" }}>Error</h2>
          <pre className="mono" style={{ fontSize: "0.75rem", whiteSpace: "pre-wrap", margin: 0, color: "var(--error)" }}>
            {run.error}
          </pre>
        </div>
      )}

      {/* Task Input */}
      {task && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20, marginTop: 14 }}>
          <h2 style={{ marginBottom: 12, fontSize: "0.875rem" }}>Task Input</h2>
          <pre className="mono" style={{
            fontSize: "0.75rem", background: "var(--bg-sunken)", padding: 12,
            borderRadius: "var(--r-md)", overflow: "auto", maxHeight: 300, lineHeight: 1.5, margin: 0,
          }}>
            {JSON.stringify(task.input, null, 2)}
          </pre>
        </div>
      )}

      {/* Task Output */}
      {task?.output && (
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20, marginTop: 14 }}>
          <h2 style={{ marginBottom: 12, fontSize: "0.875rem" }}>Task Output</h2>
          <pre className="mono" style={{
            fontSize: "0.75rem", background: "var(--bg-sunken)", padding: 12,
            borderRadius: "var(--r-md)", overflow: "auto", maxHeight: 400, lineHeight: 1.5, margin: 0,
          }}>
            {JSON.stringify(task.output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontSize: "0.75rem", fontWeight: 500 }} className={mono ? "mono" : ""}>{value}</span>
    </div>
  );
}
