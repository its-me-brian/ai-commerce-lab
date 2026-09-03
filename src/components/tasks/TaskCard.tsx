"use client";

import React from "react";
import { Badge } from "@/components/ui/Badge";
import { formatTime } from "@/lib/utils/format";

export interface TaskRecord {
  id: string;
  agent_id: string;
  status: "pending" | "ready" | "running" | "completed" | "failed" | "cancelled";
  task_type: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  priority: number;
  error: string | null;
  depends_on: string[];
  parent_task_id: string | null;
  total_cost: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  agents?: { name: string } | null;
}

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  pending: "default",
  ready: "info",
  running: "warning",
  completed: "success",
  failed: "error",
  cancelled: "default",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  ready: "Ready",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const PRIORITY_LABEL: Record<number, { label: string; variant: "default" | "success" | "warning" | "error" }> = {
  1: { label: "Critical", variant: "error" },
  2: { label: "High", variant: "warning" },
  3: { label: "Medium", variant: "default" },
  4: { label: "Low", variant: "default" },
  5: { label: "Lowest", variant: "default" },
};

export function TaskCard({ task }: { task: TaskRecord }) {
  const agentName = task.agents?.name || task.agent_id;
  const statusVariant = STATUS_VARIANT[task.status] || "default";
  const priority = PRIORITY_LABEL[task.priority] || PRIORITY_LABEL[3];

  // Extract meaningful info from input
  const inputStr = typeof task.input === "object"
    ? (task.input.productName as string) || (task.input.goal as string) || JSON.stringify(task.input).slice(0, 100)
    : String(task.input);

  return (
    <div
      className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--r-lg)] p-4 hover:shadow-[var(--shadow-md)] transition-shadow"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant={statusVariant}>{STATUS_LABEL[task.status]}</Badge>
          <span className="text-xs font-medium" style={{ color: "var(--text-tertiary)" }}>
            {task.task_type}
          </span>
        </div>
        <Badge variant={priority.variant}>{priority.label}</Badge>
      </div>

      {/* Agent */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
          style={{ background: "var(--accent)" }}
        >
          {agentName.charAt(0)}
        </div>
        <span className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>
          {agentName}
        </span>
      </div>

      {/* Input summary */}
      <p className="text-sm mb-3 line-clamp-2" style={{ color: "var(--text-primary)" }}>
        {inputStr}
      </p>

      {/* Error message if failed */}
      {task.error && (
        <div
          className="text-xs p-2 rounded-[var(--r-md)] mb-3"
          style={{ background: "var(--error-bg)", color: "var(--error)" }}
        >
          {task.error}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-tertiary)" }}>
        <span>{formatTime(task.created_at)}</span>
        {task.total_cost > 0 && (
          <span>${task.total_cost.toFixed(4)}</span>
        )}
      </div>
    </div>
  );
}
