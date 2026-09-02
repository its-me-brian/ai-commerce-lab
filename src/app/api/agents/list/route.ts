import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireAuth } from "@/lib/auth/api-auth";

// GET /api/agents/list
// List all agents with their configs for the workspace selector
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

    // Merge agents with their configs
    const agentsWithConfigs = (agents || []).map((agent) => {
      const config = (configs || []).find((c) => c.agent_id === agent.id);
      return {
        ...agent,
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
