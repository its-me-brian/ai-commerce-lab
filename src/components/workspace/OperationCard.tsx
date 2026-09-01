"use client";

import React from "react";
import { Badge } from "../ui/Badge";

export interface OperationCardData {
  operationId: string;
  workflowName: string;
  status: string;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  startedAt: string;
}

const STATUS_BADGES: Record<string, "info" | "success" | "error" | "warning" | "outline"> = {
  running: "info",
  completed: "success",
  failed: "error",
  waiting: "warning",
  queued: "outline",
};

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function OperationCard({ data }: { data: OperationCardData }) {
  const progress = data.totalSteps > 0 ? (data.completedSteps / data.totalSteps) * 100 : 0;

  return (
    <div
      className="rounded-xl p-4 border"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-light)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              {data.workflowName}
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              Started {formatTime(data.startedAt)}
            </p>
          </div>
        </div>
        <Badge variant={STATUS_BADGES[data.status] || "outline"}>
          {data.status}
        </Badge>
      </div>

      {/* Progress */}
      <div className="mb-2">
        <div className="flex justify-between text-[11px] mb-1">
          <span style={{ color: "var(--text-tertiary)" }}>{data.currentStep}</span>
          <span style={{ color: "var(--text-tertiary)" }}>
            {data.completedSteps}/{data.totalSteps} steps
          </span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: "var(--bg-sunken)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progress}%`,
              background: data.status === "failed" ? "var(--error)" : "#8b5cf6",
            }}
          />
        </div>
      </div>
    </div>
  );
}
