import { NextResponse } from "next/server";
import { AIModelRouter } from "@/lib/ai/router";
import type { AIProviderSlug } from "@/lib/ai/types";

// POST /api/agents/run
// Runs an agent with a given task
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, input, config } = body as {
      agentId: string;
      input: Record<string, unknown>;
      config: {
        primaryProvider: AIProviderSlug;
        primaryModel: string;
        fallbackProvider?: AIProviderSlug;
        fallbackModel?: string;
        temperature: number;
        maxTokens: number;
      };
    };

    if (!agentId || !input || !config) {
      return NextResponse.json(
        { success: false, error: "agentId, input, and config are required" },
        { status: 400 }
      );
    }

    // For now, this is a stub that returns a mock result
    // The real implementation will use AgentEngine + AIModelRouter
    const result = {
      success: true,
      agentId,
      output: {
        score: 88,
        recommendation: "INVESTIGATE",
        reasoning: "This product shows strong demand signals with manageable competition.",
      },
      metadata: {
        providerUsed: config.primaryProvider,
        modelUsed: config.primaryModel,
        inputTokens: 150,
        outputTokens: 200,
        durationMs: 1200,
        cached: false,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(result);
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
