import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/agents/config?agentId=product-hunter
// Get agent configuration
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "agentId is required" },
        { status: 400 }
      );
    }

    // Get agent
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 }
      );
    }

    // Get config
    const { data: config } = await supabase
      .from("agent_configs")
      .select("*")
      .eq("agent_id", agentId)
      .single();

    // Get providers
    const { data: providers } = await supabase
      .from("ai_providers")
      .select("*")
      .order("name");

    // Get models
    const { data: models } = await supabase
      .from("ai_models")
      .select("*")
      .order("name");

    // Get recent runs
    const { data: recentRuns } = await supabase
      .from("agent_runs")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(5);

    // Get agent skills
    const { data: agentSkills } = await supabase
      .from("agent_skills")
      .select("skill_id, skills(id, name, slug, description, category)")
      .eq("agent_id", agentId);

    return NextResponse.json({
      success: true,
      agent,
      config,
      providers: providers || [],
      models: models || [],
      recentRuns: recentRuns || [],
      skills: agentSkills || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// PUT /api/agents/config
// Update agent configuration
export async function PUT(request: Request) {
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
        { success: false, error: "agentId, primaryProviderId, and primaryModelId are required" },
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
          temperature: temperature || 0.2,
          max_output_tokens: maxTokens || 4096,
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
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
