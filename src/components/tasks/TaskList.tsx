"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";

interface Task {
  id: string;
  agent_id: string;
  status: string;
  task_type: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  priority: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  agents?: { name: string } | null;
}

const STATUS_VARIANT: Record<string, "info" | "success" | "warning" | "error" | "outline"> = {
  pending: "outline",
  ready: "info",
  running: "warning",
  completed: "success",
  failed: "error",
  cancelled: "outline",
};

function formatTime(timestamp: string | null): string {
  if (!timestamp) return "—";
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function TaskList({ limit = 10 }: { limit?: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchTasks() {
      try {
        const res = await fetch(`/api/tasks?limit=${limit}`);
        const data = await res.json();
        if (!cancelled && data.success) {
          setTasks(data.tasks);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchTasks();

    // Poll for updates every 30s
    const interval = setInterval(fetchTasks, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [limit]);

  return (
    <Card>
      <CardHeader title="Recent Tasks" />
      <CardContent>
        {loading ? (
          <div className="py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Loading...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>No tasks yet</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
              Tasks will appear when agents run
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Badge variant={STATUS_VARIANT[task.status] || "outline"}>
                  {task.status}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {task.agents?.name || task.agent_id} — {task.task_type}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>
                    {typeof task.input === "object"
                      ? JSON.stringify(task.input).slice(0, 80)
                      : String(task.input).slice(0, 80)}
                  </p>
                </div>
                <span className="text-[10px] shrink-0" style={{ color: "var(--text-tertiary)" }}>
                  {formatTime(task.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
