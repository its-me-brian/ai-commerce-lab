// Agent Model Routes
// Manages the model pool for each agent — which models an agent can use
// and how to route between them (priority, cheapest, fastest).
// FASE 9: Replaces rigid primary/fallback with flexible model pool.

import { supabase } from "../database/supabase";

export type RoutingPolicy = "priority" | "cheapest" | "fastest";

export interface AgentModelRoute {
  id: string;
  agent_id: string;
  model_id: string;
  priority: number;
  policy: RoutingPolicy;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RouteCreateInput {
  agent_id: string;
  model_id: string;
  priority?: number;
  policy?: RoutingPolicy;
  enabled?: boolean;
}

export interface RouteUpdateInput {
  priority?: number;
  policy?: RoutingPolicy;
  enabled?: boolean;
}

export class AgentModelRoutes {
  /**
   * Get all routes, ordered by agent_id and priority.
   * V1: Falls back to ws-default routes when workspace has none.
   */
  async list(workspaceId: string): Promise<AgentModelRoute[]> {
    if (!workspaceId) return [];
    const { data, error } = await supabase
      .from("agent_model_routes")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("agent_id")
      .order("priority");

    if (error || !data) return [];
    const routes = data as AgentModelRoute[];

    // V1 fallback: if no routes for this workspace, use ws-default routes
    if (routes.length === 0 && workspaceId !== "ws-default") {
      const { data: fallbackData } = await supabase
        .from("agent_model_routes")
        .select("*")
        .eq("workspace_id", "ws-default")
        .order("agent_id")
        .order("priority");

      if (fallbackData && fallbackData.length > 0) {
        return fallbackData as AgentModelRoute[];
      }
    }

    return routes;
  }

  /**
   * Get all routes for an agent, ordered by priority.
   * V1: Falls back to ws-default routes when workspace has none.
   */
  async listByAgent(agentId: string, workspaceId: string): Promise<AgentModelRoute[]> {
    if (!workspaceId) return [];
    const { data, error } = await supabase
      .from("agent_model_routes")
      .select("*")
      .eq("agent_id", agentId)
      .eq("workspace_id", workspaceId)
      .order("priority");

    if (error || !data) return [];
    const routes = data as AgentModelRoute[];

    if (routes.length === 0 && workspaceId !== "ws-default") {
      const { data: fallbackData } = await supabase
        .from("agent_model_routes")
        .select("*")
        .eq("agent_id", agentId)
        .eq("workspace_id", "ws-default")
        .order("priority");

      if (fallbackData && fallbackData.length > 0) {
        return fallbackData as AgentModelRoute[];
      }
    }

    return routes;
  }

  /**
   * Get only enabled routes for an agent.
   * V1: Falls back to ws-default routes when workspace has none (new workspace onboarding).
   */
  async listEnabledByAgent(agentId: string, workspaceId: string): Promise<AgentModelRoute[]> {
    if (!workspaceId) return [];
    const { data, error } = await supabase
      .from("agent_model_routes")
      .select("*")
      .eq("agent_id", agentId)
      .eq("workspace_id", workspaceId)
      .eq("enabled", true)
      .order("priority");

    if (error || !data) return [];
    const routes = data as AgentModelRoute[];

    // V1 fallback: if no routes for this workspace, use ws-default routes
    if (routes.length === 0 && workspaceId !== "ws-default") {
      const { data: fallbackData } = await supabase
        .from("agent_model_routes")
        .select("*")
        .eq("agent_id", agentId)
        .eq("workspace_id", "ws-default")
        .eq("enabled", true)
        .order("priority");

      if (fallbackData && fallbackData.length > 0) {
        return fallbackData as AgentModelRoute[];
      }
    }

    return routes;
  }

  /**
   * Get a specific route by ID.
   */
  async getById(id: string, workspaceId: string): Promise<AgentModelRoute | null> {
    if (!workspaceId) return null;
    const { data, error } = await supabase
      .from("agent_model_routes")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !data) return null;
    return data as AgentModelRoute;
  }

  /**
   * Get the route for a specific agent+model combination.
   */
  async getByAgentAndModel(
    agentId: string,
    modelId: string,
    workspaceId: string
  ): Promise<AgentModelRoute | null> {
    if (!workspaceId) return null;
    const { data, error } = await supabase
      .from("agent_model_routes")
      .select("*")
      .eq("agent_id", agentId)
      .eq("model_id", modelId)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !data) return null;
    return data as AgentModelRoute;
  }

  /**
   * Get all routes that use a specific model.
   */
  async listByModel(modelId: string, workspaceId: string): Promise<AgentModelRoute[]> {
    if (!workspaceId) return [];
    const { data, error } = await supabase
      .from("agent_model_routes")
      .select("*")
      .eq("model_id", modelId)
      .eq("workspace_id", workspaceId);

    if (error || !data) return [];
    return data as AgentModelRoute[];
  }

  /**
   * Create a new route.
   */
  async create(input: RouteCreateInput, workspaceId: string): Promise<AgentModelRoute | null> {
    if (!workspaceId) return null;
    const { data, error } = await supabase
      .from("agent_model_routes")
      .insert({
        agent_id: input.agent_id,
        model_id: input.model_id,
        priority: input.priority ?? 0,
        policy: input.policy ?? "priority",
        enabled: input.enabled !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        workspace_id: workspaceId,
      })
      .select()
      .single();

    if (error || !data) return null;
    return data as AgentModelRoute;
  }

  /**
   * Update an existing route.
   */
  async update(
    id: string,
    input: RouteUpdateInput
  ): Promise<AgentModelRoute | null> {
    const { data, error } = await supabase
      .from("agent_model_routes")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return null;
    return data as AgentModelRoute;
  }

  /**
   * Enable or disable a route.
   */
  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    const { error } = await supabase
      .from("agent_model_routes")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("id", id);

    return !error;
  }

  /**
   * Delete a route.
   */
  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("agent_model_routes")
      .delete()
      .eq("id", id);

    return !error;
  }

  /**
   * Delete all routes for an agent.
   */
  async deleteAllForAgent(agentId: string): Promise<boolean> {
    const { error } = await supabase
      .from("agent_model_routes")
      .delete()
      .eq("agent_id", agentId);

    return !error;
  }
}

// Singleton
let instance: AgentModelRoutes | null = null;

export function getAgentModelRoutes(): AgentModelRoutes {
  if (!instance) {
    instance = new AgentModelRoutes();
  }
  return instance;
}
