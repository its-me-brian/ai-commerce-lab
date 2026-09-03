import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";

// GET /api/agents/[id]/handoffs
// Get handoff events for tasks owned by this agent in the current workspace
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  // Get task IDs for this agent in current workspace
  const { data: tasks } = await supabase
    .from("agent_tasks")
    .select("id")
    .eq("agent_id", id)
    .eq("workspace_id", auth.workspaceId);

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ success: true, handoffs: [] });
  }

  const taskIds = tasks.map(t => t.id);

  const { data, error } = await supabase
    .from("task_events")
    .select("*")
    .in("task_id", taskIds)
    .eq("event_type", "handoff")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, handoffs: data });
}
