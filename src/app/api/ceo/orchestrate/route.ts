import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { AgentEngine } from "@/lib/agents/core/engine";
import { bootstrap, getAgentRegistry } from "@/lib/ai/bootstrap";

// POST /api/ceo/orchestrate
// Direct CEO orchestration — uses AgentEngine for budget enforcement and task tracking.
// Accepts { goal, workflow? } — CEO creates plan and coordinates agents.
export async function POST(request: NextRequest) {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { goal, workflow } = body as { goal?: string; workflow?: string };

    if (!goal && !workflow) {
      return NextResponse.json(
        { success: false, error: "Goal or workflow is required" },
        { status: 400 }
      );
    }

    // Ensure providers + agents are registered
    bootstrap();

    // Verify CEO agent exists
    const registry = getAgentRegistry();
    if (!registry.has("ceo")) {
      return NextResponse.json(
        { success: false, error: "CEO agent not found in registry" },
        { status: 500 }
      );
    }

    // Build input for CEO
    const input: Record<string, unknown> = {};
    if (goal) input.goal = goal;
    if (workflow) input.workflow = workflow;

    // Execute via engine (budget checks + task tracking + cost recording)
    const engine = new AgentEngine();
    const { taskId, result } = await engine.executeTask("ceo", input, {
      taskType: workflow || "orchestration",
      workspaceId: auth.workspaceId,
    });

    return NextResponse.json({
      success: result.success,
      taskId,
      plan: result.structuredData,
      output: result.output,
      reasoningSummary: result.reasoningSummary,
      errors: result.errors,
      metadata: result.metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: message.startsWith("Budget exceeded") ? message : "An unexpected error occurred",
      },
      { status: message.startsWith("Budget exceeded") ? 429 : 500 }
    );
  }
}
