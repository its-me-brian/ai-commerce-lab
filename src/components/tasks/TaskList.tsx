"use client";

import React, { useState, useEffect } from "react";
import { TaskCard, type TaskRecord } from "./TaskCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

interface TaskListProps {
  agentId?: string;
  limit?: number;
}

export function TaskList({ agentId, limit = 50 }: TaskListProps) {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function fetchTasks() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (agentId) params.set("agentId", agentId);
        if (statusFilter !== "all") params.set("status", statusFilter);
        params.set("limit", String(limit));

        const res = await fetch(`/api/tasks?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          setTasks(data.tasks || []);
          setTotal(data.total || 0);
        } else {
          setError(data.error || "Failed to load tasks");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tasks");
      } finally {
        setLoading(false);
      }
    }

    fetchTasks();
  }, [agentId, statusFilter, limit]);

  const statusCounts = {
    all: total,
    pending: tasks.filter((t) => t.status === "pending").length,
    running: tasks.filter((t) => t.status === "running").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Status filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "pending", "running", "completed", "failed"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-[var(--r-md)] text-xs font-medium transition-colors ${
              statusFilter === status
                ? "bg-[var(--accent-light)] text-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="ml-1.5 text-[10px] opacity-60">{statusCounts[status]}</span>
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12" role="status" aria-label="Loading tasks">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Loading tasks...
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <ErrorMessage message={error} />
      )}

      {/* Empty state */}
      {!loading && !error && tasks.length === 0 && (
        <EmptyState
          icon="📋"
          title="No tasks found"
          description="Tasks will appear here."
        />
      )}

      {/* Task grid */}
      {!loading && !error && tasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
