"use client";

import React from "react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export interface ApprovalCardData {
  approvalId: string;
  type: string;
  status: string;
  agentName: string;
  description: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

const STATUS_BADGES: Record<string, "warning" | "success" | "error" | "outline"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
  expired: "outline",
};

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ApprovalCard({
  data,
  onApprove,
  onReject,
}: {
  data: ApprovalCardData;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        background: "var(--bg-card)",
        borderColor: data.status === "pending" ? "var(--warning)" : "var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--warning-bg)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              Approval Required
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              {data.agentName} · {formatTime(data.createdAt)}
            </p>
          </div>
        </div>
        <Badge variant={STATUS_BADGES[data.status] || "outline"}>
          {data.status}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        {data.description}
      </p>

      {/* Details */}
      {data.details && Object.keys(data.details).length > 0 && (
        <div
          className="mb-3 p-2 rounded-lg text-[11px]"
          style={{ background: "var(--bg-sunken)", fontFamily: "var(--font-mono)" }}
        >
          <pre className="whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
            {JSON.stringify(data.details, null, 2)}
          </pre>
        </div>
      )}

      {/* Actions */}
      {data.status === "pending" && (onApprove || onReject) && (
        <div className="flex gap-2">
          {onApprove && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onApprove(data.approvalId)}
            >
              Approve
            </Button>
          )}
          {onReject && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReject(data.approvalId)}
            >
              Reject
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
