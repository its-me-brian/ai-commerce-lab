"use client";

import React, { useState, useEffect } from "react";
import { ApprovalCard, type ApprovalRecord } from "./ApprovalCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

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
      const res = await fetch(`/api/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });

      const data = await res.json();

      if (data.success && data.approval) {
        setApprovals((prev) =>
          prev.map((a) => (a.id === id ? { ...a, ...data.approval } : a))
        );
      } else {
        setError(data.error || "Failed to review approval");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review approval");
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
        <div className="flex items-center justify-center py-12" role="status" aria-label="Loading approvals">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Loading approvals...
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <ErrorMessage message={error} />
      )}

      {/* Empty state */}
      {!loading && !error && approvals.length === 0 && (
        <EmptyState
          icon="✅"
          title="No approvals found"
          description="Approval requests will appear here."
        />
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
