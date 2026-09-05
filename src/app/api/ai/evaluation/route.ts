import { NextRequest, NextResponse } from "next/server";
import { getEvaluationEngine } from "@/lib/ai/evaluation";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logging";

// GET /api/ai/evaluation
// Get evaluation history and aggregated metrics
export async function GET(request: NextRequest) {
  try {
    const auth = await requireWorkspaceAccess(request);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "recent";
    const count = parseInt(searchParams.get("count") || "50");

    const engine = getEvaluationEngine();

    switch (action) {
      case "recent": {
        const recent = engine.getRecent(count);
        return NextResponse.json({ success: true, evaluations: recent });
      }
      case "aggregated": {
        const agg = engine.getAggregated();
        return NextResponse.json({ success: true, aggregated: agg });
      }
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error("Route handler error", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
