import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Fetch KPIs in parallel
  const [
    agentsResult,
    activeAgentsResult,
    tasksResult,
    completedTasksResult,
    failedTasksResult,
    runningTasksResult,
    costResult,
    tokenResult,
    recentRunsResult,
    pendingApprovalsResult,
    recentEventsResult,
  ] = await Promise.all([
    supabase.from("agents").select("*", { count: "exact", head: true }),
    supabase.from("agents").select("*", { count: "exact", head: true }).eq("enabled", true).eq("status", "ready"),
    supabase.from("agent_tasks").select("*", { count: "exact", head: true }),
    supabase.from("agent_tasks").select("*", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("agent_tasks").select("*", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("agent_tasks").select("*", { count: "exact", head: true }).eq("status", "running"),
    supabase.from("agent_runs").select("cost").gt("cost", 0),
    supabase.from("agent_runs").select("total_tokens"),
    supabase.from("agent_runs").select("id, agent_id, model, status, duration_ms, created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("approvals").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("task_events").select("*").order("created_at", { ascending: false }).limit(10),
  ]);

  const totalAgents = agentsResult.count || 0;
  const activeAgents = activeAgentsResult.count || 0;
  const totalTasks = tasksResult.count || 0;
  const completedTasks = completedTasksResult.count || 0;
  const failedTasks = failedTasksResult.count || 0;
  const runningTasks = runningTasksResult.count || 0;
  const pendingApprovals = pendingApprovalsResult.count || 0;

  const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : null;

  const totalCost = costResult.data
    ? costResult.data.reduce((sum, run) => sum + (run.cost || 0), 0)
    : 0;

  const totalTokens = tokenResult.data
    ? tokenResult.data.reduce((sum, run) => sum + (run.total_tokens || 0), 0)
    : 0;

  const recentRuns = recentRunsResult.data || [];
  const recentEvents = (recentEventsResult.data || []) as Array<{
    id: string;
    task_id: string;
    event_type: string;
    message: string | null;
    created_at: string;
  }>;

  // Agent health breakdown
  const { data: agentStatuses } = await supabase
    .from("agents")
    .select("status, enabled");

  const agentHealth = {
    ready: 0,
    error: 0,
    disabled: 0,
    other: 0,
  };

  for (const a of agentStatuses || []) {
    if (!a.enabled) agentHealth.disabled++;
    else if (a.status === "ready") agentHealth.ready++;
    else if (a.status === "error") agentHealth.error++;
    else agentHealth.other++;
  }

  return (
    <div className="page-padding" style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ marginBottom: 3 }}>Operations Center</h1>
        <p>Your AI commerce agents at a glance</p>
      </div>

      {/* Primary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <KpiCard
          label="Active Agents"
          value={`${activeAgents}`}
          sub={`of ${totalAgents} total`}
          accent={activeAgents > 0}
        />
        <KpiCard
          label="Tasks Run"
          value={`${totalTasks}`}
          sub={`${runningTasks} running now`}
          accent={runningTasks > 0}
        />
        <KpiCard
          label="Success Rate"
          value={successRate !== null ? `${successRate}%` : "—"}
          sub={successRate !== null ? `${completedTasks} completed` : "No data yet"}
          accent={successRate !== null && successRate >= 80}
          warn={successRate !== null && successRate < 60}
        />
        <KpiCard
          label="AI Cost"
          value={totalCost > 0 ? `$${totalCost.toFixed(4)}` : "—"}
          sub={totalCost > 0 ? `${totalTokens.toLocaleString()} tokens` : "Not tracked"}
        />
        <KpiCard
          label="Pending Approvals"
          value={`${pendingApprovals}`}
          sub={pendingApprovals > 0 ? "Requires review" : "All clear"}
          warn={pendingApprovals > 0}
        />
        <KpiCard
          label="Failed Tasks"
          value={`${failedTasks}`}
          sub={failedTasks > 0 ? "Needs attention" : "None"}
          warn={failedTasks > 0}
        />
      </div>

      {/* Agent Health + Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        {/* Agent Health */}
        <Card title="Agent Health">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <HealthBar label="Ready" count={agentHealth.ready} total={totalAgents} color="var(--success)" />
            <HealthBar label="Error" count={agentHealth.error} total={totalAgents} color="var(--error)" />
            <HealthBar label="Disabled" count={agentHealth.disabled} total={totalAgents} color="var(--text-tertiary)" />
            <HealthBar label="Other" count={agentHealth.other} total={totalAgents} color="var(--warning)" />
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
            <a href="/dashboard/agents" style={{ fontSize: "0.75rem", color: "var(--accent)", textDecoration: "none" }}>
              View all agents →
            </a>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card title="Recent Activity" subtitle="Last 8 runs">
          {recentRuns.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {recentRuns.map((run) => (
                <a key={run.id} href={`/dashboard/runs/${run.id}`} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 10px", borderRadius: "var(--r-md)",
                  fontSize: "0.75rem", textDecoration: "none", color: "inherit",
                  background: "var(--bg-sunken)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StatusDot status={run.status} />
                    <span style={{ fontWeight: 500 }}>{run.agent_id}</span>
                    <span style={{ color: "var(--text-tertiary)" }}>· {run.model}</span>
                  </div>
                  <span style={{ color: "var(--text-tertiary)", fontSize: "0.6875rem" }}>
                    {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>}
              title="No activity yet"
              description="Run your first agent task."
            />
          )}
        </Card>
      </div>

      {/* Event Log + Quick Actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Event Log */}
        <Card title="Event Log" subtitle="Latest task events">
          {recentEvents.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
              {recentEvents.map((evt) => (
                <div key={evt.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 10px", borderRadius: "var(--r-md)",
                  fontSize: "0.6875rem", background: "var(--bg-sunken)",
                }}>
                  <EventTypeBadge type={evt.event_type} />
                  <span style={{ flex: 1, color: "var(--text-secondary)" }}>
                    {evt.message || evt.event_type}
                  </span>
                  <span style={{ color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
                    {new Date(evt.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", padding: "12px 0" }}>
              No events recorded yet.
            </p>
          )}
        </Card>

        {/* Quick Actions */}
        <Card title="Quick Actions">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <QuickAction href="/dashboard/agents" label="View Agents" description="See all agents and their status" />
            <QuickAction href="/dashboard/runs" label="Run History" description="View all agent executions" />
            <QuickAction href="/dashboard/models" label="Configure Models" description="Set up AI providers and models" />
            <QuickAction href="/dashboard/settings" label="Settings" description="API keys and environment" />
            {pendingApprovals > 0 && (
              <div style={{
                marginTop: 4, padding: "10px 12px", borderRadius: "var(--r-md)",
                background: "var(--warning-light, #fff3cd)", border: "1px solid var(--warning, #ffc107)",
                fontSize: "0.75rem",
              }}>
                <strong>{pendingApprovals} approval{pendingApprovals !== 1 ? "s" : ""}</strong> waiting for review
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// --- Components ---

function Card({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", padding: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: "0.875rem", fontWeight: 600 }}>{title}</h2>
          {subtitle && <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 2 }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, accent, warn }: {
  label: string; value: string; sub?: string; accent?: boolean; warn?: boolean;
}) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: "var(--r-lg)", padding: "14px 16px",
      borderColor: warn ? "var(--error)" : accent ? "var(--success)" : undefined,
    }}>
      <p style={{ fontSize: "0.6875rem", fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</span>
      </div>
      {sub && <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function HealthBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", marginBottom: 4 }}>
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ color: "var(--text-tertiary)" }}>{count}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "var(--bg-sunken)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 300ms" }} />
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === "completed" ? "var(--success)"
    : status === "failed" ? "var(--error)"
    : status === "running" ? "var(--accent)"
    : "var(--text-tertiary)";
  return <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

function EventTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    status_change: "var(--accent)",
    error: "var(--error)",
    progress_update: "var(--success)",
    delegate: "var(--warning)",
    retry: "var(--warning)",
  };
  const labels: Record<string, string> = {
    status_change: "STATUS",
    error: "ERROR",
    progress_update: "PROGRESS",
    delegate: "DELEGATE",
    retry: "RETRY",
    created: "CREATE",
  };
  return (
    <span style={{
      fontSize: "0.5625rem", fontWeight: 600, letterSpacing: "0.04em",
      color: colors[type] || "var(--text-tertiary)",
      whiteSpace: "nowrap",
    }}>
      {labels[type] || type.toUpperCase()}
    </span>
  );
}

function EmptyState({ icon, title, description }: {
  icon: React.ReactNode; title: string; description: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 0", textAlign: "center" }}>
      <div style={{ marginBottom: 10, opacity: 0.5 }}>{icon}</div>
      <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", maxWidth: 240 }}>{description}</p>
    </div>
  );
}

function QuickAction({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <a href={href} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
      borderRadius: "var(--r-md)", border: "1px solid var(--border-subtle)", textDecoration: "none",
      transition: "border-color 150ms",
    }}>
      <div style={{ width: 28, height: 28, borderRadius: "var(--r-md)", background: "var(--accent-light)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
      <div>
        <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)" }}>{label}</p>
        <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>{description}</p>
      </div>
    </a>
  );
}
