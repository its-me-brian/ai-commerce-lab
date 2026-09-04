// Workspace Service
// CRUD operations for workspaces.
// FASE 18: Enhanced company context builder with agents, providers, and rules.

import { supabase } from "../database/supabase";
import type { Workspace, WorkspaceInsert, WorkspaceUpdate, CompanyContext } from "./types";

const DEFAULT_WORKSPACE_ID = "ws-default";

function getDefaultWorkspaceId(): string {
  if (process.env.NODE_ENV === "production") {
    console.warn("[WorkspaceService] Falling back to default workspace in production — this should not happen. Check workspace resolution chain.");
  }
  return DEFAULT_WORKSPACE_ID;
}

export interface EnhancedCompanyContext extends CompanyContext {
  active_agents: Array<{ id: string; name: string; status: string; department: string | null }>;
  configured_providers: Array<{ slug: string; name: string; configured: boolean }>;
  recent_tasks: Array<{ id: string; agent_id: string; status: string; created_at: string }>;
  delegation_rules_summary: string;
}

export class WorkspaceService {
  /**
   * Get workspace by ID. Falls back to default workspace.
   */
  async get(id?: string): Promise<Workspace | null> {
    const workspaceId = id || getDefaultWorkspaceId();

    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();

    if (error || !data) {
      // Try to get default workspace
      if (workspaceId !== getDefaultWorkspaceId()) {
        return this.get(getDefaultWorkspaceId());
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
   * Build basic company context for agent execution.
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
   * FASE 18: Build enhanced company context with agents, providers, and rules.
   */
  async buildEnhancedContext(workspaceId?: string): Promise<EnhancedCompanyContext> {
    const baseContext = await this.buildCompanyContext(workspaceId);

    // Get active agents
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name, status, department")
      .eq("enabled", true);

    // Get configured providers
    const { data: providers } = await supabase
      .from("ai_providers")
      .select("slug, name, api_key_env_var, enabled");

    // Get recent tasks
    const { data: tasks } = await supabase
      .from("agent_tasks")
      .select("id, agent_id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    const configuredProviders = (providers || []).map((p: Record<string, unknown>) => ({
      slug: p.slug as string,
      name: p.name as string,
      configured: !!(p.api_key_env_var && process.env[p.api_key_env_var as string]),
    }));

    return {
      ...baseContext,
      active_agents: (agents || []) as Array<{ id: string; name: string; status: string; department: string | null }>,
      configured_providers: configuredProviders,
      recent_tasks: (tasks || []) as Array<{ id: string; agent_id: string; status: string; created_at: string }>,
      delegation_rules_summary: "CEO delegates to departments, departments delegate to specialists",
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

  /**
   * FASE 18: Format enhanced context for prompt inclusion.
   */
  formatEnhancedContextForPrompt(context: EnhancedCompanyContext): string {
    const base = this.formatContextForPrompt(context);
    const parts = [base, ``];

    // Active agents
    if (context.active_agents.length > 0) {
      parts.push(`## Active Agents`);
      for (const agent of context.active_agents) {
        parts.push(`- ${agent.name} (${agent.status}) — ${agent.department || "no dept"}`);
      }
      parts.push(``);
    }

    // Provider status
    if (context.configured_providers.length > 0) {
      parts.push(`## Configured Providers`);
      for (const provider of context.configured_providers) {
        parts.push(`- ${provider.name}: ${provider.configured ? "✅ configured" : "❌ not configured"}`);
      }
      parts.push(``);
    }

    // Recent activity
    if (context.recent_tasks.length > 0) {
      parts.push(`## Recent Tasks`);
      for (const task of context.recent_tasks.slice(0, 5)) {
        parts.push(`- ${task.agent_id}: ${task.status} (${task.created_at})`);
      }
      parts.push(``);
    }

    // Delegation rules
    parts.push(`## Delegation Rules`);
    parts.push(`- ${context.delegation_rules_summary}`);

    return parts.join("\n");
  }

  private async getActiveProductCount(_workspaceId: string): Promise<number> {
    // Will be implemented when products table exists
    return 0;
  }

  private async getPendingTaskCount(_workspaceId: string): Promise<number> {
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
