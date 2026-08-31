import { NextResponse } from "next/server";
import { bootstrapProviders } from "@/lib/ai/bootstrap";
import { AgentEngine } from "@/lib/agents/core/engine";
import { ProductHunterAgent } from "@/lib/agents/product-hunter";

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

    // Ensure AI providers are registered
    bootstrapProviders();

    // Execute via engine (handles: config loading, task creation, run logging)
    const engine = new AgentEngine();
    const { taskId, result } = await engine.executeTask(agent, body, {
      taskType: "product_analysis",
    });

    return NextResponse.json({
      success: result.success,
      taskId,
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
