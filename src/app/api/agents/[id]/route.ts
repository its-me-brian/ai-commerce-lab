// PATCH /api/agents/[id] — Update agent profile fields (name, description, etc.)
// GET /api/agents/[id] — Get agent details

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const auth = await requireWorkspaceAccess(request);
    if ("error" in auth) return auth.error;

    const { id } = await params;

    const { data: agent, error } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", auth.workspaceId)
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { success: false, error: "Agent not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, agent });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const auth = await requireWorkspaceAccess(request);
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
      .eq("workspace_id", auth.workspaceId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, agent: data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
