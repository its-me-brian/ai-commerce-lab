import { supabase } from "@/lib/database/supabase";
import { getWorkspaceId } from "@/lib/database/supabase-server";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { groupTasksByDay, groupTasksByAgent } from "@/types/dashboard";
import type { AgentRun, AppEvent, AgentTask, AgentHealthData } from "@/types/dashboard";

export const dynamic = "force-dynamic";

// ─── Status dot (server-safe, no "use client") ────────────────────
function StatusDot({ status }: { status: string }) {
  const color =
    status === "completed" ? "var(--success)"
    : status === "failed" ? "var(--error)"
    : status === "running" ? "var(--accent)"
    : "var(--text-tertiary)";
  return (
    <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
  );
}

// ─── Event type badge ──────────────────────────────────────────────
const EVENT_COLORS: Record<string, string> = {
  status_change: "var(--accent)",
  error: "var(--error)",
  progress_update: "var(--success)",
  delegate: "var(--warning)",
  retry: "var(--warning)",
};

const EVENT_LABELS: Record<string, string> = {
  status_change: "STATUS",
  error: "ERROR",
  progress_update: "PROGRESS",
  delegate: "DELEGATE",
  retry: "RETRY",
  created: "CREATE",
};

function EventTypeBadge({ type }: { type: string }) {
  return (
    <span
      className="text-[0.5625rem] font-semibold tracking-wide whitespacenowrap"
      style={{ color: EVENT_COLORS[type] || "var(--text-tertiary)" }}
    >
      {EVENT_LABELS[type] || type.toUpperCase()}
    </span>
  );
}

// ─── Health bar ────────────────────────────────────────────────────
function HealthBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ color: "var(--text-tertiary)" }}>{count}</span>
      </div>
      <div className="h-1 rounded-full" style={{ background: "var(--bg-sunken)" }}>
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── KPI card ──────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className="rounded-[var(--r-lg)] border px-4 py-3.5"
      style={{
        background: "var(--bg-card)",
        borderColor: warn ? "var(--error)" : accent ? "var(--success)" : "var(--border)",
      }}
    >
      <p
        className="text-[0.6875rem] font-medium uppercase tracking-widest mb-1.5"
        style={{ color: "var(--text-tertiary)" }}
      >
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold tracking-tight leading-none" style={{ color: "var(--text-primary)" }}>
          {value}
        </span>
      </div>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Quick action link ─────────────────────────────────────────────
function QuickAction({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-[var(--r-md)] border px-3 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
      style={{ borderColor: "var(--border-subtle)", textDecoration: "none" }}
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--r-md)]"
        style={{ background: "var(--accent-light)" }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {label}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
          {description}
        </p>
      </div>
    </a>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAGE (Server Component)
// ═══════════════════════════════════════════════════════════════════
export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { workspaceId?: string };
}) {
  const workspaceId = searchParams?.workspaceId || await getWorkspaceId();

  // ── Fetch all data in parallel (filtered by workspace) ───────────
  const base = { workspace_id: workspaceId };

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
    allTasksResult,
  ] = await Promise.all([
    supabase.from("agents").select("*", { count: "exact", head: true }).or(`workspace_id.eq.${workspaceId},workspace_id.is.null`),
    supabase.from("agents").select("*", { count: "exact", head: true }).or(`workspace_id.eq.${workspaceId},workspace_id.is.null`).eq("enabled", true).eq("status", "ready"),
    supabase.from("agent_tasks").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("agent_tasks").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "completed"),
    supabase.from("agent_tasks").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "failed"),
    supabase.from("agent_tasks").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "running"),
    supabase.from("agent_runs").select("cost").eq("workspace_id", workspaceId).gt("cost", 0),
    supabase.from("agent_runs").select("total_tokens").eq("workspace_id", workspaceId),
    supabase
      .from("agent_runs")
      .select("id, agent_id, model, status, duration_ms, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("approvals").select("*", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "pending"),
    supabase.from("task_events").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(10),
    // All tasks for chart data (last 7 days)
    supabase
      .from("agent_tasks")
      .select("id, agent_id, status, created_at")
      .eq("workspace_id", workspaceId)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: false }),
  ]);

  // ── Compute KPIs ─────────────────────────────────────────────────
  const totalAgents = agentsResult.count || 0;
  const activeAgents = activeAgentsResult.count || 0;
  const totalTasks = tasksResult.count || 0;
  const completedTasks = completedTasksResult.count || 0;
  const failedTasks = failedTasksResult.count || 0;
  const runningTasks = runningTasksResult.count || 0;
  const pendingApprovals = pendingApprovalsResult.count || 0;

  const successRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : null;

  const totalCost = costResult.data
    ? costResult.data.reduce((sum, r) => sum + ((r as { cost: number }).cost || 0), 0)
    : 0;

  const totalTokens = tokenResult.data
    ? tokenResult.data.reduce((sum, r) => sum + ((r as { total_tokens: number }).total_tokens || 0), 0)
    : 0;

  const recentRuns = (recentRunsResult.data || []) as unknown as AgentRun[];
  const recentEvents = (recentEventsResult.data || []) as unknown as AppEvent[];

  // ── Agent health breakdown ───────────────────────────────────────
  const { data: agentStatuses } = await supabase
    .from("agents")
    .select("status, enabled")
    .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);

  const agentHealth: AgentHealthData = { ready: 0, error: 0, disabled: 0, other: 0 };
  for (const a of agentStatuses || []) {
    if (!(a as { enabled: boolean }).enabled) agentHealth.disabled++;
    else if ((a as { status: string }).status === "ready") agentHealth.ready++;
    else if ((a as { status: string }).status === "error") agentHealth.error++;
    else agentHealth.other++;
  }

  // ── Chart data ───────────────────────────────────────────────────
  const allTasks = (allTasksResult.data || []) as unknown as AgentTask[];
  const tasksByDay = groupTasksByDay(allTasks, 7);
  const agentActivity = groupTasksByAgent(allTasks);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="page-padding max-w-[1200px]">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Operations Center
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
          Your AI commerce agents at a glance
        </p>
      </div>

      {/* ── KPI Grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
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

      {/* ── Charts ───────────────────────────────────────────────── */}
      <div className="mb-5">
        <DashboardCharts tasksByDay={tasksByDay} agentActivity={agentActivity} />
      </div>

      {/* ── Agent Health + Recent Activity ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card>
          <CardHeader title="Agent Health" />
          <CardContent>
            <div className="flex flex-col gap-2.5">
              <HealthBar label="Ready" count={agentHealth.ready} total={totalAgents} color="var(--success)" />
              <HealthBar label="Error" count={agentHealth.error} total={totalAgents} color="var(--error)" />
              <HealthBar label="Disabled" count={agentHealth.disabled} total={totalAgents} color="var(--text-tertiary)" />
              <HealthBar label="Other" count={agentHealth.other} total={totalAgents} color="var(--warning)" />
            </div>
            <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--border-subtle)" }}>
              <a
                href="/dashboard/agents"
                className="text-xs font-medium no-underline"
                style={{ color: "var(--accent)" }}
              >
                View all agents →
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Recent Activity" subtitle="Last 8 runs" />
          <CardContent>
            {recentRuns.length > 0 ? (
              <div className="flex flex-col gap-1">
                {recentRuns.map((run) => (
                  <a
                    key={run.id}
                    href={`/dashboard/runs/${run.id}`}
                    className="flex items-center justify-between rounded-[var(--r-md)] px-2.5 py-1.5 text-xs no-underline transition-colors hover:bg-[var(--bg-hover)]"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    <div className="flex items-center gap-2">
                      <StatusDot status={run.status} />
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {run.agent_id}
                      </span>
                      <span style={{ color: "var(--text-tertiary)" }}>· {run.model}</span>
                    </div>
                    <span className="text-[0.6875rem]" style={{ color: "var(--text-tertiary)" }}>
                      {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="⏱️"
                title="No activity yet"
                description="Run your first agent task."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Event Log + Quick Actions ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Event Log" subtitle="Latest task events" />
          <CardContent>
            {recentEvents.length > 0 ? (
              <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto">
                {recentEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center gap-2 rounded-[var(--r-md)] px-2.5 py-1.5"
                    style={{ background: "var(--bg-sunken)", fontSize: "0.6875rem" }}
                  >
                    <EventTypeBadge type={evt.event_type} />
                    <span className="flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                      {evt.message || evt.event_type}
                    </span>
                    <span className="whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>
                      {new Date(evt.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs py-3" style={{ color: "var(--text-tertiary)" }}>
                No events recorded yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Quick Actions" />
          <CardContent>
            <div className="flex flex-col gap-1.5">
              <QuickAction href="/dashboard/agents" label="View Agents" description="See all agents and their status" />
              <QuickAction href="/dashboard/runs" label="Run History" description="View all agent executions" />
              <QuickAction href="/dashboard/settings" label="Settings" description="AI providers, models, budgets, and security" />
              {pendingApprovals > 0 && (
                <div
                  className="mt-1 rounded-[var(--r-md)] border px-3 py-2.5 text-xs"
                  style={{
                    background: "var(--warning-bg)",
                    borderColor: "var(--warning)",
                  }}
                >
                  <strong>
                    {pendingApprovals} approval{pendingApprovals !== 1 ? "s" : ""}
                  </strong>{" "}
                  waiting for review
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
