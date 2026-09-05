import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";

// GET /api/agents/config?agentId=product-hunter
// Get agent configuration
export const GET = withSecurity(async (request: NextRequest) => {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "agentId query parameter is required" } },
        { status: 400 }
      );
    }

    // Get agent (global agents have workspace_id IS NULL)
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .or(`workspace_id.eq.${auth.workspaceId},workspace_id.is.null`)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: { code: "AGENT_NOT_FOUND", message: "Agent not found" } },
        { status: 404 }
      );
    }

    // Get config (fallback to ws-default for new workspaces)
    // eslint-disable-next-line prefer-const
    let { data: config, error: configError } = await supabase
      .from("agent_configs")
      .select("*")
      .eq("agent_id", agentId)
      .eq("workspace_id", auth.workspaceId)
      .single();

    if (configError && configError.code !== "PGRST116") {
      console.error(`[API] Failed to load config for ${agentId}:`, configError.message);
    }

    // V1 fallback: use ws-default config if workspace has none
    if (!config && auth.workspaceId !== "ws-default") {
      const { data: fallbackConfig } = await supabase
        .from("agent_configs")
        .select("*")
        .eq("agent_id", agentId)
        .eq("workspace_id", "ws-default")
        .single();
      config = fallbackConfig || null;
    }

    // Get providers (global table — no workspace_id filter)
    const { data: providers, error: providersError } = await supabase
      .from("ai_providers")
      .select("*")
      .order("name");

    if (providersError) {
      console.error("[API] Failed to load providers:", providersError.message);
    }

    // Get models (global table — no workspace_id filter)
    const { data: models, error: modelsError } = await supabase
      .from("ai_models")
      .select("*")
      .order("name");

    if (modelsError) {
      console.error("[API] Failed to load models:", modelsError.message);
    }

    // Get recent runs
    const { data: recentRuns, error: runsError } = await supabase
      .from("agent_runs")
      .select("*")
      .eq("agent_id", agentId)
      .eq("workspace_id", auth.workspaceId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (runsError) {
      console.error("[API] Failed to load runs:", runsError.message);
    }

    // Get agent skills (scoped via agent's workspace_id from query above)
    const { data: agentSkills, error: skillsError } = await supabase
      .from("agent_skills")
      .select("skill_id, skills(id, name, slug, description, category)")
      .eq("agent_id", agentId);

    if (skillsError) {
      console.error("[API] Failed to load skills:", skillsError.message);
    }

    return NextResponse.json({
      success: true,
      agent,
      config: config || null,
      providers: providers || [],
      models: models || [],
      recentRuns: recentRuns || [],
      skills: agentSkills || [],
    });
  } catch  {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
});

// PUT /api/agents/config
// Update agent configuration
export const PUT = withSecurity(async (request: NextRequest) => {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const {
      agentId,
      primaryProviderId,
      primaryModelId,
      fallbackProviderId,
      fallbackModelId,
      temperature,
      maxTokens,
    } = body;

    if (!agentId || !primaryProviderId || !primaryModelId) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "agentId, primaryProviderId, and primaryModelId are required",
          },
        },
        { status: 400 }
      );
    }

    // Validate temperature range
    if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Temperature must be between 0 and 2" } },
        { status: 400 }
      );
    }

    // Validate maxTokens range
    if (maxTokens !== undefined && (maxTokens < 256 || maxTokens > 128000)) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "maxTokens must be between 256 and 128000" } },
        { status: 400 }
      );
    }

    // Upsert config
    const { data, error } = await supabase
      .from("agent_configs")
      .upsert(
        {
          agent_id: agentId,
          primary_provider_id: primaryProviderId,
          primary_model_id: primaryModelId,
          fallback_provider_id: fallbackProviderId || null,
          fallback_model_id: fallbackModelId || null,
          temperature: temperature ?? 0.2,
          max_output_tokens: maxTokens ?? 4096,
          workspace_id: auth.workspaceId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "agent_id" }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      config: data,
    });
  } catch  {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
});
