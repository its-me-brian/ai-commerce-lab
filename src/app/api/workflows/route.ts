// Workflows API
// Execute and list workflows. Requires workspace access.

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { getWorkflowRegistry } from "@/lib/ai/workflow/registry";
import { WorkflowExecutor } from "@/lib/ai/workflow/executor";
import { withSecurity } from "@/lib/security/api-middleware";

/**
 * GET /api/workflows
 * List all registered workflows.
 */
export const GET = withSecurity(async (req: NextRequest) => {
  const auth = await requireWorkspaceAccess(req);
  if ("error" in auth) return auth.error;

  const registry = getWorkflowRegistry();
  await registry.ensureLoaded();
  const allWorkflows = await registry.list();
  const workflows = allWorkflows.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    nodes: w.nodes.length,
  }));

  return NextResponse.json({ workflows });
});

/**
 * POST /api/workflows
 * Execute a workflow.
 * Body: { workflowId: string, input: Record<string, unknown> }
 */
export const POST = withSecurity(async (req: NextRequest) => {
  const auth = await requireWorkspaceAccess(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const { workflowId, input } = body;

  if (!workflowId) {
    return NextResponse.json({ error: "Missing workflowId" }, { status: 400 });
  }

  const registry = getWorkflowRegistry();
  await registry.ensureLoaded();
  const definition = await registry.get(workflowId);

  if (!definition) {
    return NextResponse.json({ error: `Workflow not found: ${workflowId}` }, { status: 404 });
  }

  const executor = new WorkflowExecutor();
  const result = await executor.execute(definition, {
    input: input || {},
    maxParallel: 3,
    onNodeStateChange: (nodeId: string, state: { status: string }) => {
      console.log(`[Workflow] Node ${nodeId}: ${state.status}`);
    },
  });

  return NextResponse.json({
    success: result.status === "completed",
    status: result.status,
    output: result.output,
    durationMs: result.summary.totalDurationMs,
    summary: result.summary,
  });
});
