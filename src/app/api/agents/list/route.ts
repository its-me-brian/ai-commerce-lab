import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireAuth } from "@/lib/auth/api-auth";

// GET /api/agents/list
// List all agents with their configs and definitions for the workspace selector
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const auth = await requireAuth(request);
    if ("error" in auth) return auth.error;

    // Get all agents
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("*")
      .order("name");

    if (agentsError) {
      throw agentsError;
    }

    // Get all configs
    const { data: configs, error: configsError } = await supabase
      .from("agent_configs")
      .select("*");

    if (configsError) {
      console.error("[API] Failed to load configs:", configsError.message);
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
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
