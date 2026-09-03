"use client";

import React from "react";
import { ApprovalList } from "@/components/approvals/ApprovalList";

export default function ApprovalsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          Approvals
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
          Review and manage agent approval requests
        </p>
      </div>

      {/* Approval list */}
      <ApprovalList limit={100} />
    </div>
  );
}
