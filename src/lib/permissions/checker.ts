// Permission Checker
// Validates agent permissions before execution.
// Checks against database-stored permissions with fallback to defaults.

import { supabase } from "../database/supabase";
import type { Permission, PermissionAction, AgentPermissions } from "./types";
import { DEFAULT_PERMISSIONS } from "./types";

export class PermissionChecker {
  /**
   * Check if an agent has a specific permission.
   */
  async hasPermission(
    agentId: string,
    action: PermissionAction,
    target: string
  ): Promise<boolean> {
    const permissions = await this.getAgentPermissions(agentId);

    // Check for explicit deny first
    const denyMatch = permissions.find(
      (p) =>
        p.action === action &&
        !p.granted &&
        (p.target === "*" || p.target === target)
    );
    if (denyMatch) return false;

    // Check for explicit grant
    const grantMatch = permissions.find(
      (p) =>
        p.action === action &&
        p.granted &&
        (p.target === "*" || p.target === target)
    );
    if (grantMatch) return true;

    // Check role-based defaults
    const role = await this.getAgentRole(agentId);
    const roleDefaults = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.restricted;

    return roleDefaults.some(
      (p) =>
        p.action === action &&
        p.granted &&
        (p.target === "*" || p.target === target)
    );
  }

  /**
   * Get all permissions for an agent.
   */
  async getAgentPermissions(agentId: string): Promise<Permission[]> {
    const { data, error } = await supabase
      .from("agent_permissions")
      .select("*")
      .eq("agent_id", agentId);

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      action: row.action as PermissionAction,
      target: row.target,
      granted: row.granted,
      conditions: row.conditions || [],
    }));
  }

  /**
   * Get agent role from database.
   */
  async getAgentRole(agentId: string): Promise<string> {
    const { data, error } = await supabase
      .from("agents")
      .select("role")
      .eq("id", agentId)
      .single();

    if (error || !data) {
      return "restricted";
    }

    return data.role || "restricted";
  }

  /**
   * Grant a permission to an agent.
   */
  async grant(
    agentId: string,
    action: PermissionAction,
    target: string,
    conditions?: Array<{ type: string; value: number; unit?: string }>
  ): Promise<void> {
    await supabase.from("agent_permissions").upsert({
      agent_id: agentId,
      action,
      target,
      granted: true,
      conditions: conditions || [],
    });
  }

  /**
   * Revoke a permission from an agent.
   */
  async revoke(
    agentId: string,
    action: PermissionAction,
    target: string
  ): Promise<void> {
    await supabase.from("agent_permissions").upsert({
      agent_id: agentId,
      action,
      target,
      granted: false,
      conditions: [],
    });
  }

  /**
   * Check all permissions for an agent execution context.
   */
  async validateExecution(
    agentId: string,
    context: {
      tools?: string[];
      provider?: string;
      targetAgent?: string;
    }
  ): Promise<{ allowed: boolean; denied: string[] }> {
    const denied: string[] = [];

    // Check tool permissions
    if (context.tools) {
      for (const toolId of context.tools) {
        const allowed = await this.hasPermission(agentId, "call_tool", toolId);
        if (!allowed) {
          denied.push(`Tool access denied: ${toolId}`);
        }
      }
    }

    // Check provider permissions
    if (context.provider) {
      const allowed = await this.hasPermission(
        agentId,
        "use_provider",
        context.provider
      );
      if (!allowed) {
        denied.push(`Provider access denied: ${context.provider}`);
      }
    }

    // Check agent access permissions
    if (context.targetAgent) {
      const allowed = await this.hasPermission(
        agentId,
        "access_agent",
        context.targetAgent
      );
      if (!allowed) {
        denied.push(`Agent access denied: ${context.targetAgent}`);
      }
    }

    return {
      allowed: denied.length === 0,
      denied,
    };
  }
}

// Singleton
let checkerInstance: PermissionChecker | null = null;

export function getPermissionChecker(): PermissionChecker {
  if (!checkerInstance) {
    checkerInstance = new PermissionChecker();
  }
  return checkerInstance;
}
