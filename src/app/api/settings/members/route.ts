// Settings Members API
// PHASE 1: Manage workspace members.
// Owner/admin can invite/remove members, change roles.

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess, requirePermission } from "@/lib/auth/api-auth";
import { createClient } from "@supabase/supabase-js";
import { withSecurity } from "@/lib/security/api-middleware";

/**
 * GET /api/settings/members
 * List all members of the workspace.
 */
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const access = await requireWorkspaceAccess(request);
    if ("error" in access) return access.error;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: members, error } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", access.workspaceId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      members: members || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/settings/members
 * Add a member to the workspace.
 * Body: { user_id, role }
 */
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const access = await requireWorkspaceAccess(request, { minimumRole: "admin" });
    if ("error" in access) return access.error;

    const perm = requirePermission(access.role, "members.invite");
    if ("error" in perm) return perm.error;

    const body = await request.json();
    const { user_id, role } = body;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "Missing user_id" },
        { status: 400 }
      );
    }

    const validRoles = ["owner", "admin", "member", "viewer"];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: member, error } = await supabase
      .from("workspace_members")
      .upsert({
        workspace_id: access.workspaceId,
        user_id,
        role: role || "member",
      }, { onConflict: "workspace_id,user_id" })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      member,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});

/**
 * PATCH /api/settings/members
 * Update a member's role.
 * Body: { user_id, role }
 */
export const PATCH = withSecurity(async (request: NextRequest) => {
  try {
    const access = await requireWorkspaceAccess(request, { minimumRole: "admin" });
    if ("error" in access) return access.error;

    const body = await request.json();
    const { user_id, role } = body;

    if (!user_id || !role) {
      return NextResponse.json(
        { success: false, error: "Missing user_id or role" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: member, error } = await supabase
      .from("workspace_members")
      .update({ role })
      .eq("workspace_id", access.workspaceId)
      .eq("user_id", user_id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      member,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/settings/members?user_id=xxx
 * Remove a member from the workspace.
 */
export const DELETE = withSecurity(async (request: NextRequest) => {
  try {
    const access = await requireWorkspaceAccess(request, { minimumRole: "admin" });
    if ("error" in access) return access.error;

    const perm = requirePermission(access.role, "members.remove");
    if ("error" in perm) return perm.error;

    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing user_id" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from("workspace_members")
      .delete()
      .eq("workspace_id", access.workspaceId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: "Member removed from workspace",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});
