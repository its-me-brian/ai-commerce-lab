import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";

// GET /api/agents/list
// List all agents with their configs and definitions for the workspace selector
// PHASE 1: Now requires workspace membership
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    // Auth + workspace check
    const access = await requireWorkspaceAccess(request);
    if ("error" in access) return access.error;

    const { workspaceId } = access;

    // Get all agents for this workspace (plus global agents with no workspace)
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("*")
      .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
      .order("name");

    if (agentsError) {
      throw agentsError;
    }

    // Get all configs for this workspace (fallback to ws-default for new workspaces)
    // eslint-disable-next-line prefer-const
    let { data: configs, error: configsError } = await supabase
      .from("agent_configs")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (configsError) {
      console.error("[API] Failed to load configs:", configsError.message);
    }

    // V1 fallback: new workspaces have no configs — use ws-default
    if ((!configs || configs.length === 0) && workspaceId !== "ws-default") {
      const { data: fallbackConfigs } = await supabase
        .from("agent_configs")
        .select("*")
        .eq("workspace_id", "ws-default");
      configs = fallbackConfigs || [];
    }

    // Get agent definitions for identity merge
    const { data: definitions, error: defsError } = await supabase
      .from("agent_definitions")
      .select("slug, identity_name, identity_role, identity_description, mission, expertise, rules, skills");

    if (defsError) {
      console.error("[API] Failed to load definitions:", defsError.message);
    }

    // Merge agents with their configs and definitions
    const defsMap = new Map((definitions || []).map((d) => [d.slug, d]));
    const agentsWithConfigs = (agents || []).map((agent) => {
      const config = (configs || []).find((c) => c.agent_id === agent.id);
      const def = defsMap.get(agent.id);

      return {
        ...agent,
        // Merge identity from definition if available (overrides stale agents table data)
        name: def?.identity_name || agent.name,
        description: def?.identity_description || agent.description,
        role: def?.identity_role || agent.role,
        mission: def?.mission || agent.mission || null,
        config: config || null,
      };
    });

    return NextResponse.json({
      success: true,
      agents: agentsWithConfigs,
      workspaceId,
    });
  } catch  {
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});
