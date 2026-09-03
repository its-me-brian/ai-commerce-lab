"use client";

import React, { useState, useEffect } from "react";
import { TaskCard, type TaskRecord } from "./TaskCard";
import { Badge } from "@/components/ui/Badge";

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
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Loading tasks...
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          className="text-sm p-4 rounded-[var(--r-md)]"
          style={{ background: "var(--error-bg)", color: "var(--error)" }}
        >
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: "var(--bg-sunken)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-tertiary)" }}>
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
            No tasks found
          </p>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Tasks will appear here when agents execute them
          </p>
        </div>
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
