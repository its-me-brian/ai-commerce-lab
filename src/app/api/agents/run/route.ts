import { NextResponse } from "next/server";
import { bootstrap, getAgentRegistry } from "@/lib/ai/bootstrap";
import { AgentEngine } from "@/lib/agents/core/engine";

// POST /api/agents/run
// Generic agent execution endpoint.
// Accepts { agentId, input } — config comes from Supabase, never from the client.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, input } = body as {
      agentId: string;
      input: Record<string, unknown>;
    };

    if (!agentId || !input) {
      return NextResponse.json(
        { success: false, error: "agentId and input are required" },
        { status: 400 }
      );
    }

    // Ensure providers + agents are registered
    bootstrap();

    // Look up agent from registry
    const registry = getAgentRegistry();
    const agent = registry.get(agentId);

    if (!agent) {
      return NextResponse.json(
        { success: false, error: `Agent not found: ${agentId}` },
        { status: 404 }
      );
    }

    if (!agent.isEnabled()) {
      return NextResponse.json(
        { success: false, error: `Agent is not enabled: ${agentId}` },
        { status: 400 }
      );
    }

    // Execute via engine (handles: config, tasks, runs, Supabase)
    const engine = new AgentEngine();
    const { taskId, result } = await engine.executeTask(agent, input, {
      taskType: "product_analysis",
    });

    return NextResponse.json({
      success: result.success,
      taskId,
      agentId,
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
