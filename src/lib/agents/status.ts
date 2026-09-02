// Agent Status Derivation
// §35: Derive agent status from actual activity (runs, messages, errors)
// NOT from static database field

import { supabase } from "../database/supabase";

export type AgentStatus = "online" | "working" | "idle" | "warning" | "error" | "disabled";

interface ActivityData {
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastMessageAt: string | null;
  recentErrorCount: number;
  enabled: boolean;
}

/**
 * Derive agent status from actual activity data.
 * - working: has a run in the last 5 minutes
 * - online: has activity in the last hour
 * - idle: no activity in the last hour
 * - warning: has recent errors but also successful runs
 * - error: last run failed or has many recent errors
 * - disabled: agent is disabled
 */
export function deriveAgentStatus(activity: ActivityData): AgentStatus {
  if (!activity.enabled) return "disabled";

  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  const lastRunTime = activity.lastRunAt ? new Date(activity.lastRunAt).getTime() : 0;
  const lastMessageTime = activity.lastMessageAt ? new Date(activity.lastMessageAt).getTime() : 0;
  const latestActivity = Math.max(lastRunTime, lastMessageTime);

  // Check for errors
  if (activity.recentErrorCount > 3) return "error";
  if (activity.lastRunStatus === "failed") return "error";

  // Check for recent activity
  if (latestActivity > fiveMinutesAgo) return "working";
  if (latestActivity > oneHourAgo) return "online";

  // Check for warning state (recent errors but also successes)
  if (activity.recentErrorCount > 0 && activity.lastRunStatus === "completed") return "warning";

  return "idle";
}

/**
 * Fetch activity data for multiple agents in a single query.
 * Returns a map of agentId → ActivityData.
 */
export async function getAgentsActivity(agentIds: string[]): Promise<Map<string, ActivityData>> {
  const result = new Map<string, ActivityData>();

  if (agentIds.length === 0) return result;

  // Initialize all agents as idle
  for (const id of agentIds) {
    result.set(id, {
      lastRunAt: null,
      lastRunStatus: null,
      lastMessageAt: null,
      recentErrorCount: 0,
      enabled: true,
    });
  }

  // Fetch agent enabled status
  const { data: agents } = await supabase
    .from("agents")
    .select("id, enabled")
    .in("id", agentIds);

  if (agents) {
    for (const agent of agents) {
      const existing = result.get(agent.id);
      if (existing) {
        existing.enabled = agent.enabled;
      }
    }
  }

  // Fetch last run for each agent
  const { data: lastRuns } = await supabase
    .from("agent_runs")
    .select("agent_id, status, created_at")
    .in("agent_id", agentIds)
    .order("created_at", { ascending: false })
    .limit(agentIds.length * 2); // Get 2 per agent for error counting

  if (lastRuns) {
    // Group by agent
    const runsByAgent = new Map<string, Array<{ status: string; created_at: string }>>();
    for (const run of lastRuns) {
      if (!runsByAgent.has(run.agent_id)) {
        runsByAgent.set(run.agent_id, []);
      }
      runsByAgent.get(run.agent_id)!.push(run);
    }

    for (const [agentId, runs] of runsByAgent) {
      const existing = result.get(agentId);
      if (!existing) continue;

      // Most recent run
      if (runs.length > 0) {
        existing.lastRunAt = runs[0].created_at;
        existing.lastRunStatus = runs[0].status;
      }

      // Count recent errors (last 24 hours)
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      existing.recentErrorCount = runs.filter(
        (r) => r.status === "failed" && new Date(r.created_at).getTime() > oneDayAgo
      ).length;
    }
  }

  // Fetch last message for each agent (from conversation_messages where metadata->>'agent_id' = agentId)
  // This is expensive so we do it in parallel
  const messagePromises = agentIds.map(async (agentId) => {
    const { data } = await supabase
      .from("conversation_messages")
      .select("created_at")
      .eq("role", "assistant")
      .contains("metadata", { agent_id: agentId })
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return { agentId, lastMessageAt: data?.created_at || null };
  });

  const messageResults = await Promise.all(messagePromises);
  for (const { agentId, lastMessageAt } of messageResults) {
    const existing = result.get(agentId);
    if (existing && lastMessageAt) {
      existing.lastMessageAt = lastMessageAt;
    }
  }

  return result;
}

/**
 * Get derived status for a single agent.
 */
export async function getAgentStatus(agentId: string, enabled: boolean): Promise<AgentStatus> {
  const activityMap = await getAgentsActivity([agentId]);
  const activity = activityMap.get(agentId);
  if (!activity) return enabled ? "idle" : "disabled";
  activity.enabled = enabled;
  return deriveAgentStatus(activity);
}
