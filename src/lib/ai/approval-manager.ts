// Approval Manager
// Human-in-the-loop: agents pause and request approval before critical actions.
// FASE 29: Every high-risk action requires human review.

import { supabase } from "../database/supabase";

export type ApprovalActionType =
  | "product_listing"
  | "price_change"
  | "supplier_order"
  | "marketing_campaign"
  | "refund"
  | "agent_delegation"
  | "workflow_launch"
  | "data_delete"
  | "config_change"
  | "custom";

export type ApprovalRiskLevel = "low" | "medium" | "high" | "critical";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "cancelled";

export interface Approval {
  id: string;
  agent_id: string;
  task_id: string | null;
  action_type: ApprovalActionType;
  action_summary: string;
  action_details: Record<string, unknown>;
  risk_level: ApprovalRiskLevel;
  status: ApprovalStatus;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CreateApprovalInput {
  agent_id: string;
  task_id?: string;
  action_type: ApprovalActionType;
  action_summary: string;
  action_details?: Record<string, unknown>;
  risk_level?: ApprovalRiskLevel;
  /** Auto-expire after this time (default: 24 hours) */
  expires_in_ms?: number;
}

export interface ReviewApprovalInput {
  approval_id: string;
  decision: "approved" | "rejected";
  notes?: string;
  /** Optional modified action details (e.g., approve with different price) */
  modifications?: Record<string, unknown>;
}

/**
 * Approval Manager
 * Handles human-in-the-loop approval workflows.
 */
export class ApprovalManager {
  /**
   * Create an approval request. Agent should await this before proceeding.
   */
  async createApproval(input: CreateApprovalInput, workspaceId: string): Promise<Approval> {
    if (!workspaceId) {
      throw new Error("workspaceId is required for approval creation");
    }
    const now = new Date().toISOString();
    const expiresAt = input.expires_in_ms
      ? new Date(Date.now() + input.expires_in_ms).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h default

    const { data, error } = await supabase
      .from("approvals")
      .insert({
        agent_id: input.agent_id,
        task_id: input.task_id || null,
        action_type: input.action_type,
        action_summary: input.action_summary,
        action_details: input.action_details || {},
        risk_level: input.risk_level || "medium",
        status: "pending",
        expires_at: expiresAt,
        created_at: now,
        workspace_id: workspaceId,
      })
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to create approval: ${error?.message}`);
    return data as Approval;
  }

  /**
   * Review an approval (approve or reject).
   */
  async reviewApproval(input: ReviewApprovalInput, workspaceId: string): Promise<Approval> {
    const { data: existing, error: fetchError } = await supabase
      .from("approvals")
      .select("status")
      .eq("id", input.approval_id)
      .eq("workspace_id", workspaceId)
      .single();

    if (fetchError || !existing) throw new Error("Approval not found");
    if ((existing as Approval).status !== "pending") {
      throw new Error(`Approval already ${(existing as Approval).status}`);
    }

    const details = input.modifications
      ? { ...(({} as Record<string, unknown>)), modifications: input.modifications }
      : undefined;

    const { data, error } = await supabase
      .from("approvals")
      .update({
        status: input.decision,
        reviewer_notes: input.notes || null,
        reviewed_at: new Date().toISOString(),
        ...(details ? { action_details: details } : {}),
      })
      .eq("id", input.approval_id)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to review approval: ${error?.message}`);
    return data as Approval;
  }

  /**
   * Check if an approval has been approved.
   */
  async isApproved(approvalId: string, workspaceId: string): Promise<boolean> {
    const { data } = await supabase
      .from("approvals")
      .select("status")
      .eq("id", approvalId)
      .eq("workspace_id", workspaceId)
      .single();

    return (data as Approval)?.status === "approved";
  }

  /**
   * Wait for an approval decision (polls every second).
   * Returns the approval when decided, or null on timeout.
   */
  async waitForApproval(
    approvalId: string,
    workspaceId: string,
    timeoutMs: number = 300000 // 5 minutes default
  ): Promise<Approval | null> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const { data } = await supabase
        .from("approvals")
        .select("*")
        .eq("id", approvalId)
        .eq("workspace_id", workspaceId)
        .single();

      if (!data) return null;
      const approval = data as Approval;

      if (approval.status !== "pending") return approval;

      // Check expiry
      if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
        await this.expireApproval(approvalId, workspaceId);
        return { ...approval, status: "expired" };
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return null; // Timeout
  }

  /**
   * Expire an approval that has passed its deadline.
   */
  async expireApproval(approvalId: string, workspaceId: string): Promise<Approval | null> {
    const { data, error } = await supabase
      .from("approvals")
      .update({ status: "expired", reviewed_at: new Date().toISOString() })
      .eq("id", approvalId)
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .select()
      .single();

    if (error || !data) return null;
    return data as Approval;
  }

  /**
   * Cancel an approval request (e.g., task was cancelled).
   */
  async cancelApproval(approvalId: string, workspaceId: string): Promise<Approval | null> {
    const { data, error } = await supabase
      .from("approvals")
      .update({ status: "cancelled", reviewed_at: new Date().toISOString() })
      .eq("id", approvalId)
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .select()
      .single();

    if (error || !data) return null;
    return data as Approval;
  }

  /**
   * Get all pending approvals for a workspace.
   */
  async getPendingApprovals(workspaceId: string): Promise<Approval[]> {
    const { data, error } = await supabase
      .from("approvals")
      .select("*")
      .eq("status", "pending")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as Approval[];
  }

  /**
   * Get approvals for a specific agent within a workspace.
   */
  async getApprovalsByAgent(agentId: string, workspaceId: string): Promise<Approval[]> {
    const { data, error } = await supabase
      .from("approvals")
      .select("*")
      .eq("agent_id", agentId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as Approval[];
  }

  /**
   * Get approval by ID within a workspace.
   */
  async getApproval(approvalId: string, workspaceId: string): Promise<Approval | null> {
    const { data, error } = await supabase
      .from("approvals")
      .select("*")
      .eq("id", approvalId)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !data) return null;
    return data as Approval;
  }

  /**
   * Get pending approvals count by risk level for a workspace.
   */
  async getPendingCounts(workspaceId: string): Promise<Record<ApprovalRiskLevel, number>> {
    const { data } = await supabase
      .from("approvals")
      .select("risk_level")
      .eq("status", "pending")
      .eq("workspace_id", workspaceId);

    const counts: Record<ApprovalRiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    if (data) {
      for (const row of data as { risk_level: ApprovalRiskLevel }[]) {
        counts[row.risk_level]++;
      }
    }

    return counts;
  }

  /**
   * Expire all overdue approvals for a workspace.
   */
  async expireOverdue(workspaceId: string): Promise<number> {
    const { data } = await supabase
      .from("approvals")
      .select("id")
      .eq("status", "pending")
      .eq("workspace_id", workspaceId)
      .lt("expires_at", new Date().toISOString());

    if (!data || data.length === 0) return 0;

    let expired = 0;
    for (const row of data as { id: string }[]) {
      const result = await this.expireApproval(row.id, workspaceId);
      if (result) expired++;
    }

    return expired;
  }

  /**
   * Get approval statistics for a workspace.
   */
  async getStats(workspaceId: string): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    expired: number;
    avgResponseTimeMs: number;
  }> {
    const { data } = await supabase
      .from("approvals")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (!data || data.length === 0) {
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        expired: 0,
        avgResponseTimeMs: 0,
      };
    }

    const approvals = data as Approval[];
    const reviewed = approvals.filter(
      (a) => a.reviewed_at && a.created_at
    );

    let totalResponseMs = 0;
    for (const a of reviewed) {
      totalResponseMs +=
        new Date(a.reviewed_at!).getTime() - new Date(a.created_at).getTime();
    }

    return {
      total: approvals.length,
      pending: approvals.filter((a) => a.status === "pending").length,
      approved: approvals.filter((a) => a.status === "approved").length,
      rejected: approvals.filter((a) => a.status === "rejected").length,
      expired: approvals.filter((a) => a.status === "expired").length,
      avgResponseTimeMs:
        reviewed.length > 0 ? totalResponseMs / reviewed.length : 0,
    };
  }
}

// Singleton
let instance: ApprovalManager | null = null;

export function getApprovalManager(): ApprovalManager {
  if (!instance) {
    instance = new ApprovalManager();
  }
  return instance;
}
