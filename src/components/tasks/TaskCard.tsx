"use client";

import React from "react";
import { Badge } from "../ui/Badge";

export interface TaskCardData {
  taskId: string;
  type: string;
  status: string;
  agentName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  createdAt: string;
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
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function TaskCard({ data }: { data: TaskCardData }) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--info-bg)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              Task
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              {data.taskId.slice(0, 8)}
            </p>
          </div>
        </div>
        <Badge variant={STATUS_BADGES[data.status] || "outline"}>
          {data.status}
        </Badge>
      </div>

      {/* Info */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span style={{ color: "var(--text-tertiary)" }}>Type</span>
          <span style={{ color: "var(--text-primary)" }}>{data.type}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: "var(--text-tertiary)" }}>Agent</span>
          <span style={{ color: "var(--text-primary)" }}>{data.agentName}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: "var(--text-tertiary)" }}>Created</span>
          <span style={{ color: "var(--text-primary)" }}>{formatTime(data.createdAt)}</span>
        </div>
      </div>

      {/* Input preview */}
      {data.input && Object.keys(data.input).length > 0 && (
        <div
          className="mt-3 p-2 rounded-lg text-[11px]"
          style={{ background: "var(--bg-sunken)", fontFamily: "var(--font-mono)" }}
        >
          <p className="font-semibold mb-1" style={{ color: "var(--text-tertiary)" }}>Input</p>
          <pre className="whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
            {JSON.stringify(data.input, null, 2).slice(0, 200)}
            {JSON.stringify(data.input).length > 200 ? "..." : ""}
          </pre>
        </div>
      )}
    </div>
  );
}
