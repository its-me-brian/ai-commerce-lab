import { NextRequest, NextResponse } from "next/server";
import { bootstrap, getAgentRegistry } from "@/lib/ai/bootstrap";
import { AgentEngine } from "@/lib/agents/core/engine";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";
import { logger } from "@/lib/logging";

// POST /api/agents/run
// Generic agent execution endpoint.
// Accepts { agentId, input } — config comes from Supabase, never from the client.
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // Auth check
    const auth = await requireWorkspaceAccess(request);
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { agentId, input } = body as {
      agentId: string;
      input: Record<string, unknown>;
    };

    if (!agentId || typeof agentId !== "string") {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "agentId is required and must be a string" } },
        { status: 400 }
      );
    }

    if (!input || typeof input !== "object") {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "input is required and must be an object" } },
        { status: 400 }
      );
    }

    // Ensure providers + agents are registered
    await bootstrap();

    // Verify agent exists in registry (defense in depth)
    const registry = getAgentRegistry();
    if (!registry.has(agentId)) {
      return NextResponse.json(
        { error: { code: "AGENT_NOT_FOUND", message: `Agent not found: ${agentId}` } },
        { status: 404 }
      );
    }

    // Execute via engine (handles: config, tasks, runs, permissions, Supabase)
    const engine = new AgentEngine();
    const { taskId, result } = await engine.executeTask(agentId, input, {
      taskType: "general",
      workspaceId: auth.workspaceId,
    });

    return NextResponse.json({
      success: result.success,
      taskId,
      agentId,
      data: result.structuredData,
      output: result.output,
      reasoningSummary: result.reasoningSummary,
      errors: result.errors,
      metadata: result.metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Route handler error", { error: error instanceof Error ? error.message : "unknown" });
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
