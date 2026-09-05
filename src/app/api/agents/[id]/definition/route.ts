// PATCH /api/agents/[id]/definition — Update agent definition (identity, mission, personality, expertise, rules)
// GET /api/agents/[id]/definition — Get agent definition

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { sanitizeBody } from "@/lib/security/sanitize";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireWorkspaceAccess(request);
    if ("error" in auth) return auth.error;

    const { id } = await params;

    // Get agent definition by agent slug (agent_definitions.slug = agents.id)
    const { data: definition, error } = await supabase
      .from("agent_definitions")
      .select("*")
      .eq("slug", id)
      .single();

    if (error || !definition) {
      return NextResponse.json(
        { success: false, error: "Agent definition not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, definition });
  } catch {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Admin role required for definition mutations
    const auth = await requireWorkspaceAccess(request, { minimumRole: "admin" });
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = sanitizeBody(await request.json()) as Record<string, unknown>;

    // Only allow updating specific definition fields
    const allowedFields = [
      "identity_name",
      "identity_role",
      "identity_description",
      "mission",
      "personality",
      "expertise",
      "rules",
      "skills",
      "output_instructions",
      "status",
      "enabled",
    ];

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

    // Update agent definition (by slug = agent id)
    const { data, error } = await supabase
      .from("agent_definitions")
      .update(updates)
      .eq("slug", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to update definition" },
        { status: 500 }
      );
    }

    // Also update agents.name if identity_name changed (keep in sync)
    if (updates.identity_name) {
      await supabase
        .from("agents")
        .update({ name: updates.identity_name, updated_at: new Date().toISOString() })
        .eq("id", id)
        .or(`workspace_id.eq.${auth.workspaceId},workspace_id.is.null`);
    }

    // Also update agents.description if identity_description changed
    if (updates.identity_description) {
      await supabase
        .from("agents")
        .update({ description: updates.identity_description, updated_at: new Date().toISOString() })
        .eq("id", id)
        .or(`workspace_id.eq.${auth.workspaceId},workspace_id.is.null`);
    }

    return NextResponse.json({ success: true, definition: data });
  } catch {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
