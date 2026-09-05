"use client";

import React from "react";
import { Badge } from "@/components/ui/Badge";
import { formatTime } from "@/lib/utils/format";

export interface ApprovalRecord {
  id: string;
  agent_id: string;
  task_id: string | null;
  action_type: string;
  action_summary: string;
  action_details: Record<string, unknown>;
  risk_level: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "expired" | "cancelled";
  reviewer_notes: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
  expired: "default",
  cancelled: "default",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

const RISK_VARIANT: Record<string, "default" | "success" | "warning" | "error"> = {
  low: "success",
  medium: "default",
  high: "warning",
  critical: "error",
};

const RISK_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const ACTION_TYPE_LABEL: Record<string, string> = {
  product_listing: "Product Listing",
  price_change: "Price Change",
  supplier_order: "Supplier Order",
  marketing_campaign: "Marketing Campaign",
  refund: "Refund",
  agent_delegation: "Agent Delegation",
  workflow_launch: "Workflow Launch",
  data_delete: "Data Delete",
  config_change: "Config Change",
  custom: "Custom",
};

interface ApprovalCardProps {
  approval: ApprovalRecord;
  onReview?: (id: string, decision: "approved" | "rejected") => void;
}

export function ApprovalCard({ approval, onReview }: ApprovalCardProps) {
 
  const _statusVariant = STATUS_VARIANT[approval.status] || "default";
  const riskVariant = RISK_VARIANT[approval.risk_level] || "default";

  // Check if expired
  const isExpired = approval.expires_at && new Date(approval.expires_at) < new Date();
  const displayStatus = isExpired && approval.status === "pending" ? "expired" : approval.status;

  return (
    <div
      className={`bg-[var(--bg-card)] border rounded-[var(--r-lg)] p-4 transition-shadow ${
        approval.status === "pending"
          ? "border-[var(--warning)] hover:shadow-[var(--shadow-md)]"
          : "border-[var(--border)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[displayStatus] || "default"}>
            {STATUS_LABEL[displayStatus] || displayStatus}
          </Badge>
          <Badge variant={riskVariant}>{RISK_LABEL[approval.risk_level]}</Badge>
        </div>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {ACTION_TYPE_LABEL[approval.action_type] || approval.action_type}
        </span>
      </div>

      {/* Summary */}
      <p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
        {approval.action_summary}
      </p>

      {/* Agent */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
          style={{ background: "var(--accent)" }}
        >
          {approval.agent_id.charAt(0)}
        </div>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {approval.agent_id}
        </span>
      </div>

      {/* Reviewer notes if reviewed */}
      {approval.reviewer_notes && (
        <div
          className="text-xs p-2 rounded-[var(--r-md)] mb-3"
          style={{
            background: approval.status === "approved" ? "var(--success-bg)" : "var(--error-bg)",
            color: approval.status === "approved" ? "var(--success)" : "var(--error)",
          }}
        >
          {approval.reviewer_notes}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          {formatTime(approval.created_at)}
        </span>

        {/* Action buttons for pending approvals */}
        {approval.status === "pending" && onReview && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onReview(approval.id, "rejected")}
              className="px-3 py-1.5 text-xs font-medium rounded-[var(--r-md)] transition-colors"
              style={{
                background: "var(--error-bg)",
                color: "var(--error)",
              }}
            >
              Reject
            </button>
            <button
              onClick={() => onReview(approval.id, "approved")}
              className="px-3 py-1.5 text-xs font-medium rounded-[var(--r-md)] transition-colors"
              style={{
                background: "var(--success-bg)",
                color: "var(--success)",
              }}
            >
              Approve
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
