// Workspace Service
// CRUD operations for workspaces.
// Builds company context for agents.

import { supabase } from "../database/supabase";
import type { Workspace, WorkspaceInsert, WorkspaceUpdate, CompanyContext } from "./types";

const DEFAULT_WORKSPACE_ID = "ws-default";

export class WorkspaceService {
  /**
   * Get workspace by ID. Falls back to default workspace.
   */
  async get(id?: string): Promise<Workspace | null> {
    const workspaceId = id || DEFAULT_WORKSPACE_ID;

    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();

    if (error || !data) {
      // Try to get default workspace
      if (workspaceId !== DEFAULT_WORKSPACE_ID) {
        return this.get(DEFAULT_WORKSPACE_ID);
      }
      return null;
    }

    return data as Workspace;
  }

  /**
   * List all workspaces.
   */
  async list(): Promise<Workspace[]> {
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return data as Workspace[];
  }

  /**
   * Create a new workspace.
   */
  async create(input: WorkspaceInsert): Promise<Workspace | null> {
    const { data, error } = await supabase
      .from("workspaces")
      .insert({
        ...input,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) return null;
    return data as Workspace;
  }

  /**
   * Update an existing workspace.
   */
  async update(id: string, input: WorkspaceUpdate): Promise<Workspace | null> {
    const { data, error } = await supabase
      .from("workspaces")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return null;
    return data as Workspace;
  }

  /**
   * Build company context for agent execution.
   * Includes workspace data + derived metrics.
   */
  async buildCompanyContext(workspaceId?: string): Promise<CompanyContext> {
    const workspace = await this.get(workspaceId);

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    // Get derived metrics
    const [activeProducts, pendingTasks] = await Promise.all([
      this.getActiveProductCount(workspace.id),
      this.getPendingTaskCount(workspace.id),
    ]);

    return {
      workspace,
      active_products: activeProducts,
      pending_tasks: pendingTasks,
      recent_decisions: [], // Will be populated from agent_events
    };
  }

  /**
   * Format workspace context as a prompt section for agents.
   */
  formatContextForPrompt(context: CompanyContext): string {
    const { workspace } = context;
    const parts = [
      `## Company Context`,
      ``,
      `- Company: ${workspace.name}`,
      `- Market: ${workspace.target_country}`,
      `- Currency: ${workspace.currency}`,
      `- Target Customer: ${workspace.target_customer || "Not defined"}`,
      `- Brand Voice: ${workspace.brand_voice || "Not defined"}`,
      `- Target Margin: ${workspace.target_margin}x`,
      `- Supplier Countries: ${workspace.supplier_countries.join(", ") || "None"}`,
    ];

    if (workspace.business_rules && Object.keys(workspace.business_rules).length > 0) {
      parts.push(`- Business Rules: ${JSON.stringify(workspace.business_rules)}`);
    }

    if (workspace.approval_rules && Object.keys(workspace.approval_rules).length > 0) {
      parts.push(`- Approval Rules: ${JSON.stringify(workspace.approval_rules)}`);
    }

    return parts.join("\n");
  }

  private async getActiveProductCount(_workspaceId: string): Promise<number> {
    // Will be implemented when products table exists
    return 0;
  }

  private async getPendingTaskCount(workspaceId: string): Promise<number> {
    const { count } = await supabase
      .from("agent_tasks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    return count || 0;
  }
}

// Singleton
let instance: WorkspaceService | null = null;

export function getWorkspaceService(): WorkspaceService {
  if (!instance) {
    instance = new WorkspaceService();
  }
  return instance;
}
