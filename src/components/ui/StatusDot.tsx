"use client";

import React from "react";

type Status = "online" | "working" | "idle" | "warning" | "error" | "disabled";

const COLORS: Record<Status, string> = {
  online: "var(--success)",
  working: "var(--accent)",
  idle: "var(--text-tertiary)",
  warning: "var(--warning)",
  error: "var(--error)",
  disabled: "var(--border-strong)",
};

const LABELS: Record<Status, string> = {
  online: "Online",
  working: "Working",
  idle: "Idle",
  warning: "Needs attention",
  error: "Error",
  disabled: "Disabled",
};

export function StatusDot({ status, size = "sm" }: { status: Status; size?: "xs" | "sm" | "md" }) {
  const s = size === "xs" ? "h-1.5 w-1.5" : size === "sm" ? "h-2 w-2" : "h-3 w-3";
  const animation = status === "working" ? "animate-pulse" : "";
  return (
    <span
      className={`${s} rounded-full inline-block ${animation}`}
      style={{ background: COLORS[status] }}
    />
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
      <StatusDot status={status} />
      {LABELS[status]}
    </span>
  );
}

export function getAgentStatus(enabled: boolean, status?: string): Status {
  if (!enabled) return "disabled";
  if (status === "development") return "idle";
  return "online";
}
