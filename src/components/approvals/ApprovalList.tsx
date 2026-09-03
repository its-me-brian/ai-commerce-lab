"use client";

import React, { useState, useEffect } from "react";
import { ApprovalCard, type ApprovalRecord } from "./ApprovalCard";

interface ApprovalListProps {
  agentId?: string;
  limit?: number;
}

export function ApprovalList({ agentId, limit = 50 }: ApprovalListProps) {
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchApprovals() {
      setLoading(true);
      setError(null);

      try {
        // If agentId is provided, fetch approvals for that agent
        // Otherwise, fetch all pending approvals (would need a separate API endpoint)
        const url = agentId
          ? `/api/agents/${agentId}/approvals`
          : `/api/agents/${agentId || "ceo"}/approvals`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
          let filtered = data.approvals || [];
          if (statusFilter !== "all") {
            filtered = filtered.filter((a: ApprovalRecord) => a.status === statusFilter);
          }
          setApprovals(filtered.slice(0, limit));
        } else {
          setError(data.error || "Failed to load approvals");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load approvals");
      } finally {
        setLoading(false);
      }
    }

    fetchApprovals();
  }, [agentId, statusFilter, limit]);

  const handleReview = async (id: string, decision: "approved" | "rejected") => {
    try {
      // This would need a PATCH endpoint for approvals
      // For now, we'll optimistically update the UI
      setApprovals((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: decision, reviewed_at: new Date().toISOString() }
            : a
        )
      );
    } catch (err) {
      console.error("Failed to review approval:", err);
    }
  };

  const statusCounts = {
    all: approvals.length,
    pending: approvals.filter((a) => a.status === "pending").length,
    approved: approvals.filter((a) => a.status === "approved").length,
    rejected: approvals.filter((a) => a.status === "rejected").length,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Status filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "pending", "approved", "rejected"] as const).map((status) => (
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
            Loading approvals...
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
      {!loading && !error && approvals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: "var(--bg-sunken)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-tertiary)" }}>
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
            No approvals found
          </p>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            Approval requests will appear here when agents need human review
          </p>
        </div>
      )}

      {/* Approval list */}
      {!loading && !error && approvals.length > 0 && (
        <div className="flex flex-col gap-3">
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onReview={approval.status === "pending" ? handleReview : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
