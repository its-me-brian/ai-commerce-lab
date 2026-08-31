import { NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";

// GET /api/agents/history?agentId=product-hunter&limit=20
// Get agent task history
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;

    let query = supabase
      .from("agent_tasks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      tasks: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "An unexpected error occurred",
        },
      },
      { status: 500 }
    );
  }
}
