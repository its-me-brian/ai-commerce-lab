// ─── Dashboard Types ───────────────────────────────────────────────
// Shared types for dashboard data fetching and chart components.

/** Raw row from agent_runs table */
export interface AgentRun {
  id: string;
  agent_id: string;
  model: string;
  status: string;
  duration_ms: number | null;
  cost: number | null;
  total_tokens: number | null;
  created_at: string;
}

/** Raw row from task_events / app_events table */
export interface AppEvent {
  id: string;
  event_type: string;
  severity: string | null;
  source: string | null;
  agent_id: string | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/** Raw row from agent_tasks table */
export interface AgentTask {
  id: string;
  agent_id: string;
  status: string;
  created_at: string;
}

/** KPI card data shape */
export interface KpiData {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
}

/** Agent health breakdown */
export interface AgentHealthData {
  ready: number;
  error: number;
  disabled: number;
  other: number;
}

// ─── Chart Data Shapes ─────────────────────────────────────────────

/** One day bucket for the TasksByDay chart */
export interface DayBucket {
  date: string;       // "Sep 01" display label
  dateRaw: string;    // "2026-09-01" for tooltips
  completed: number;
  failed: number;
  running: number;
}

/** One agent row for the AgentActivity chart */
export interface AgentActivityRow {
  agentId: string;
  agentName: string;
  completed: number;
  failed: number;
  total: number;
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Group tasks by day (last N days) and return chart-ready data.
 * Fills missing days with zeros so the chart is continuous.
 */
export function groupTasksByDay(
  tasks: AgentTask[],
  days: number = 7,
): DayBucket[] {
  const now = new Date();
  const buckets: DayBucket[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10); // "2026-09-01"
    const label = d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    buckets.push({ date: label, dateRaw: key, completed: 0, failed: 0, running: 0 });
  }

  const indexMap = new Map(buckets.map((b, i) => [b.dateRaw, i]));

  for (const task of tasks) {
    const day = task.created_at.slice(0, 10);
    const idx = indexMap.get(day);
    if (idx === undefined) continue;
    const bucket = buckets[idx];
    if (task.status === "completed") bucket.completed++;
    else if (task.status === "failed") bucket.failed++;
    else if (task.status === "running") bucket.running++;
  }

  return buckets;
}

/**
 * Group tasks by agent and return sorted rows for horizontal bar chart.
 */
export function groupTasksByAgent(tasks: AgentTask[]): AgentActivityRow[] {
  const map = new Map<string, AgentActivityRow>();

  for (const task of tasks) {
    const id = task.agent_id || "unknown";
    if (!map.has(id)) {
      map.set(id, { agentId: id, agentName: id, completed: 0, failed: 0, total: 0 });
    }
    const row = map.get(id)!;
    row.total++;
    if (task.status === "completed") row.completed++;
    else if (task.status === "failed") row.failed++;
  }

  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10); // top 10 agents
}
