// GET /api/agents/activity — Fetch recent runs for agent status derivation
// §35: Provides activity data for deriving real agent status

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";

export const GET = withSecurity(async (req: NextRequest) => {
  try {
    // Auth check
    const auth = await requireWorkspaceAccess(req);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json(
        { success: false, error: "ids parameter is required" },
        { status: 400 }
      );
    }

    const agentIds = idsParam.split(",").filter(Boolean);

    if (agentIds.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    // Fetch last 10 runs per agent (enough for status derivation)
    const { data: runs, error } = await supabase
      .from("agent_runs")
      .select("agent_id, status, created_at")
      .in("agent_id", agentIds)
      .eq("workspace_id", auth.workspaceId)
      .order("created_at", { ascending: false })
      .limit(agentIds.length * 10);

    if (error) {
      return NextResponse.json(
        { success: false, error: "An unexpected error occurred" },
        { status: 500 }
      );
    }

    // Group by agent
    const runsByAgent: Record<string, Array<{ status: string; created_at: string }>> = {};
    for (const id of agentIds) {
      runsByAgent[id] = [];
    }

    if (runs) {
      for (const run of runs) {
        if (runsByAgent[run.agent_id]) {
          runsByAgent[run.agent_id].push({
            status: run.status,
            created_at: run.created_at,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: runsByAgent,
    });
  } catch  {
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});
