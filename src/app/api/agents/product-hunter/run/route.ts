import { NextRequest, NextResponse } from "next/server";
import { bootstrap, getAgentRegistry } from "@/lib/ai/bootstrap";
import { AgentEngine } from "@/lib/agents/core/engine";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";

// POST /api/agents/product-hunter/run
// Legacy endpoint — redirects to generic /api/agents/run
// Kept for backward compatibility.
export const POST = withSecurity(async (request: NextRequest) => {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();

    // Ensure providers + agents are registered
    await bootstrap();

    // Verify agent exists
    const registry = getAgentRegistry();
    const agentId = "product-hunter";
    if (!registry.has(agentId)) {
      return NextResponse.json(
        { error: { code: "AGENT_NOT_FOUND", message: `Agent not found: ${agentId}` } },
        { status: 404 }
      );
    }

    // Execute via engine (handles: config, tasks, runs, permissions, Supabase)
    const engine = new AgentEngine();
    const { taskId, result } = await engine.executeTask(agentId, body, {
      taskType: "product_analysis",
      workspaceId: auth.workspaceId,
    });

    return NextResponse.json({
      success: result.success,
      taskId,
      data: result.structuredData,
      metadata: result.metadata,
      timestamp: new Date().toISOString(),
    });
  } catch  {
    return NextResponse.json(
      {
        error: {
          code: "AGENT_ERROR",
          message: "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
});
