import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";

// GET /api/conversations
// List conversations for the current workspace
export async function GET(request: NextRequest) {
  try {
    // Auth + workspace check
    const auth = await requireWorkspaceAccess(request);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("conversations")
      .select("*, agents(name)")
      .eq("workspace_id", auth.workspaceId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (agentId) query = query.eq("agent_id", agentId);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Get total count for this workspace only
    let countQuery = supabase
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", auth.workspaceId);

    if (agentId) countQuery = countQuery.eq("agent_id", agentId);

    const { count } = await countQuery;

    return NextResponse.json({ success: true, conversations: data, total: count });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
