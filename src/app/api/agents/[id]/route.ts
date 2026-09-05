// PATCH /api/agents/[id] — Update agent profile fields (name, description, etc.)
// GET /api/agents/[id] — Get agent details

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurityAndParams } from "@/lib/security/api-middleware";

export const GET = withSecurityAndParams(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    // Auth check
    const auth = await requireWorkspaceAccess(request);
    if ("error" in auth) return auth.error;

    const { id } = await params;

    const { data: agent, error } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .or(`workspace_id.eq.${auth.workspaceId},workspace_id.is.null`)
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, agent });
  } catch  {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
});

export const PATCH = withSecurityAndParams(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    // Auth check — member role required for agent mutations
    const auth = await requireWorkspaceAccess(request, { minimumRole: "member" });
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await request.json();

    // Only allow updating specific profile fields
    // §10: Added avatar_color for editable agent appearance
    const allowedFields = ["name", "description", "status", "enabled", "role", "department", "avatar_color"];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("agents")
      .update(updates)
      .eq("id", id)
      .or(`workspace_id.eq.${auth.workspaceId},workspace_id.is.null`)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to update agent" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, agent: data });
  } catch  {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
});
