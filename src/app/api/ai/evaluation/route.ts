import { NextRequest, NextResponse } from "next/server";
import { getEvaluationEngine } from "@/lib/ai/evaluation";
import { requireAuth } from "@/lib/auth/api-auth";

// GET /api/ai/evaluation
// Get evaluation history and aggregated metrics
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const auth = await requireAuth(request);
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
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
