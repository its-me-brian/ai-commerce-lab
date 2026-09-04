// PATCH /api/approvals/[id] — Review an approval (approve/reject)
// Requires workspace membership + approvals.approve permission.

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess, requirePermission } from "@/lib/auth/api-auth";
import { supabase } from "@/lib/database/supabase";

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["approved", "rejected"],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  const perm = requirePermission(auth.role, "approvals.approve");
  if ("error" in perm) return perm.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { decision, notes } = body as { decision?: string; notes?: string };

    if (!decision || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json(
        { success: false, error: "decision must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    // Fetch existing approval and validate workspace + status
    const { data: existing, error: fetchError } = await supabase
      .from("approvals")
      .select("status, workspace_id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, error: "Approval not found" },
        { status: 404 }
      );
    }

    if (existing.workspace_id !== auth.workspaceId) {
      return NextResponse.json(
        { success: false, error: "Approval not found" },
        { status: 404 }
      );
    }

    const currentStatus = (existing as { status: string }).status;
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(decision)) {
      return NextResponse.json(
        { success: false, error: `Cannot transition from '${currentStatus}' to '${decision}'` },
        { status: 409 }
      );
    }

    // Persist the decision
    const { data, error } = await supabase
      .from("approvals")
      .update({
        status: decision,
        reviewer_notes: notes || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, approval: data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
