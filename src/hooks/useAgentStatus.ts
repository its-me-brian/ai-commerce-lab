// useAgentStatus Hook
// §35: Derive agent status from actual activity on the client side

"use client";

import { useState, useEffect } from "react";

export type AgentStatus = "online" | "working" | "idle" | "warning" | "error" | "disabled";

interface ActivityData {
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastMessageAt: string | null;
  recentErrorCount: number;
  enabled: boolean;
}

function deriveStatus(activity: ActivityData): AgentStatus {
  if (!activity.enabled) return "disabled";

  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  const lastRunTime = activity.lastRunAt ? new Date(activity.lastRunAt).getTime() : 0;
  const lastMessageTime = activity.lastMessageAt ? new Date(activity.lastMessageAt).getTime() : 0;
  const latestActivity = Math.max(lastRunTime, lastMessageTime);

  if (activity.recentErrorCount > 3) return "error";
  if (activity.lastRunStatus === "failed") return "error";
  if (latestActivity > fiveMinutesAgo) return "working";
  if (latestActivity > oneHourAgo) return "online";
  if (activity.recentErrorCount > 0 && activity.lastRunStatus === "completed") return "warning";

  return "idle";
}

/**
 * Hook that fetches and derives agent status from actual activity.
 * Polls every 30 seconds to keep status current.
 */
export function useAgentStatus(
  agents: Array<{ id: string; enabled: boolean }>,
): Map<string, AgentStatus> {
  const [statusMap, setStatusMap] = useState<Map<string, AgentStatus>>(new Map());

  useEffect(() => {
    if (agents.length === 0) return;

    let cancelled = false;

    async function fetchActivity() {
      try {
        const agentIds = agents.map((a) => a.id);

        // Fetch last runs
        const { data: runs } = await fetch(
          `/api/agents/activity?ids=${agentIds.join(",")}`
        ).then((r) => r.json()).catch(() => ({ data: null }));

        // Build status map
        const newStatusMap = new Map<string, AgentStatus>();

        for (const agent of agents) {
          const agentRuns = runs?.[agent.id] || [];
          const lastRun = agentRuns[0];
          const recentErrors = agentRuns.filter(
            (r: { status: string; created_at: string }) =>
              r.status === "failed" &&
              new Date(r.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
          ).length;

          const status = deriveStatus({
            lastRunAt: lastRun?.created_at || null,
            lastRunStatus: lastRun?.status || null,
            lastMessageAt: null, // Will be fetched separately if needed
            recentErrorCount: recentErrors,
            enabled: agent.enabled,
          });

          newStatusMap.set(agent.id, status);
        }

        if (!cancelled) {
          setStatusMap(newStatusMap);
        }
      } catch {
        // On error, set all to idle/disabled based on enabled flag
        if (!cancelled) {
          const fallback = new Map<string, AgentStatus>();
          for (const agent of agents) {
            fallback.set(agent.id, agent.enabled ? "idle" : "disabled");
          }
          setStatusMap(fallback);
        }
      }
    }

    fetchActivity();
    const interval = setInterval(fetchActivity, 30000); // Poll every 30s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [agents]);

  return statusMap;
}
