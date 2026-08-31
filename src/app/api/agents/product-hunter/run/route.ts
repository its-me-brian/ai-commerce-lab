import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bootstrapProviders } from "@/lib/ai/bootstrap";
import { ProductHunterAgent } from "@/lib/agents/product-hunter";
import type { AgentConfiguration } from "@/lib/agents/core/types";
import type { AIProviderSlug } from "@/lib/ai/types";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/agents/product-hunter/run
// Runs the Product Hunter agent with a given product
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const agent = new ProductHunterAgent();

    // Validate input
    const errors = agent.validateInput(body);
    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, errors },
        { status: 400 }
      );
    }

    // Load config from Supabase
    const { data: configRow, error: configError } = await supabase
      .from("agent_configs")
      .select("*")
      .eq("agent_id", "product-hunter")
      .single();

    if (configError || !configRow) {
      return NextResponse.json(
        { success: false, error: "Agent config not found in database" },
        { status: 500 }
      );
    }

    // Resolve provider/model slugs from IDs
    const { data: primaryModel } = await supabase
      .from("ai_models")
      .select("model_id")
      .eq("id", configRow.primary_model_id)
      .single();

    const { data: fallbackModel } = configRow.fallback_model_id
      ? await supabase
          .from("ai_models")
          .select("model_id")
          .eq("id", configRow.fallback_model_id)
          .single()
      : { data: null };

    const configuration: AgentConfiguration = {
      agentId: "product-hunter",
      primaryProvider: configRow.primary_provider_id as AIProviderSlug,
      primaryModel: primaryModel?.model_id || "gemini-3-flash-preview",
      fallbackProvider: configRow.fallback_provider_id
        ? (configRow.fallback_provider_id as AIProviderSlug)
        : undefined,
      fallbackModel: fallbackModel?.model_id || undefined,
      temperature: configRow.temperature,
      maxTokens: configRow.max_output_tokens,
    };

    // Build context with database-driven configuration
    const context = {
      taskId: crypto.randomUUID(),
      taskType: "product_analysis" as const,
      input: body,
      configuration,
      tools: [],
    };

    // Ensure AI providers are registered (only knows env vars, not concrete classes)
    bootstrapProviders();

    // Execute
    const result = await agent.execute(context);

    // Log task + run to Supabase
    await supabase.from("agent_tasks").insert({
      id: context.taskId,
      agent_id: "product-hunter",
      status: result.success ? "completed" : "failed",
      task_type: "product_analysis",
      input: body,
      output: result.structuredData || null,
      error: result.errors.length > 0 ? result.errors.join(", ") : null,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    await supabase.from("agent_runs").insert({
      task_id: context.taskId,
      agent_id: "product-hunter",
      provider: configuration.primaryProvider,
      model: configuration.primaryModel,
      input_tokens: result.metadata.inputTokens,
      output_tokens: result.metadata.outputTokens,
      duration_ms: result.metadata.durationMs,
      status: result.success ? "success" : "error",
    });

    return NextResponse.json({
      success: result.success,
      data: result.structuredData,
      metadata: result.metadata,
      timestamp: new Date().toISOString(),
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
