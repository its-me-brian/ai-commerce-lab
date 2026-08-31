// Workspace Types
// Represents a company/business entity.
// All agents, tasks, and data are scoped to a workspace.

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  target_country: string;
  currency: string;
  target_customer: string | null;
  brand_voice: string | null;
  target_margin: number;
  supplier_countries: string[];
  business_rules: Record<string, unknown>;
  approval_rules: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type WorkspaceInsert = Omit<Workspace, "created_at" | "updated_at">;
export type WorkspaceUpdate = Partial<Omit<Workspace, "id" | "created_at">>;

/**
 * Shared company context that agents can access.
 * Built from workspace + derived data.
 */
export interface CompanyContext {
  workspace: Workspace;
  // Derived data — built at execution time
  active_products: number;
  pending_tasks: number;
  recent_decisions: string[];
}
