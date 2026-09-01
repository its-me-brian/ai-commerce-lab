import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";

// GET /api/tasks
// List tasks with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("agent_tasks")
      .select("*, agents(name)")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (agentId) query = query.eq("agent_id", agentId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Get total count
    let countQuery = supabase
      .from("agent_tasks")
      .select("*", { count: "exact", head: true });

    if (agentId) countQuery = countQuery.eq("agent_id", agentId);
    if (status) countQuery = countQuery.eq("status", status);

    const { count } = await countQuery;

    return NextResponse.json({ success: true, tasks: data, total: count });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
