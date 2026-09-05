import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurityAndParams } from "@/lib/security/api-middleware";

export const GET = withSecurityAndParams(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const { data, error } = await supabase
    .from("approvals" as never)
    .select("*")
    .eq("agent_id", id)
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ success: false, error: "An unexpected error occurred" }, { status: 500 });
  }

  return NextResponse.json({ success: true, approvals: data });
});
