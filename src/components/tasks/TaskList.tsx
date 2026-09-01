"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";

interface Task {
  id: string;
  agent_id: string;
  task_type: string;
  status: string;
  priority: string | null;
  created_at: string;
  agents?: { name: string } | null;
}

const STATUS_BADGES: Record<string, "success" | "warning" | "error" | "info" | "outline"> = {
  completed: "success",
  running: "info",
  pending: "warning",
  failed: "error",
  cancelled: "outline",
};

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDate(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  } catch {
    return "";
  }
}

export function TaskList({ limit = 10 }: { limit?: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const res = await fetch(`/api/tasks?limit=${limit}`);
        const data = await res.json();
        if (data.success) {
          setTasks(data.tasks);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, [limit]);

  if (loading) {
    return (
      <Card>
        <CardHeader title="Recent Tasks" />
        <CardContent>
          <div className="text-xs text-center py-4" style={{ color: "var(--text-tertiary)" }}>
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Recent Tasks" />
      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState icon="📋" title="No tasks yet" description="Tasks will appear here when agents run" />
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-2 rounded-[var(--r-md)]"
                style={{ background: "var(--bg-sunken)" }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {task.agents?.name || task.agent_id}
                  </span>
                  <Badge variant="outline">{task.task_type}</Badge>
                  <Badge variant={STATUS_BADGES[task.status] || "outline"}>
                    {task.status}
                  </Badge>
                </div>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {formatDate(task.created_at)} {formatTime(task.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
