// Settings Members API
// PHASE 1: Manage workspace members.
// Owner/admin can invite/remove members, change roles.

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess, requirePermission } from "@/lib/auth/api-auth";
import { createClient } from "@supabase/supabase-js";
import { withSecurity } from "@/lib/security/api-middleware";
import { sanitizeBody } from "@/lib/security/sanitize";

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
      .select("id, workspace_id, user_id, role, created_at, updated_at")
      .eq("workspace_id", access.workspaceId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      members: members || [],
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
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

    const body = sanitizeBody(await request.json()) as Record<string, unknown>;
    const user_id = body.user_id as string;
    const role = body.role as string;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "Missing user_id" },
        { status: 400 }
      );
    }

    const validRoles = ["admin", "member", "viewer"];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Must be one of: ${validRoles.join(", ")}. Owner can only be set by another owner.` },
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
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
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

    const body = sanitizeBody(await request.json()) as Record<string, unknown>;
    const user_id = body.user_id as string;
    const role = body.role as string;

    if (!user_id || !role) {
      return NextResponse.json(
        { success: false, error: "Missing user_id or role" },
        { status: 400 }
      );
    }

    const allowedRoles = ["owner", "admin", "member", "viewer"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Must be one of: ${allowedRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // Only owners can assign or modify owner role
    if (role === "owner" && access.role !== "owner") {
      return NextResponse.json(
        { success: false, error: "Only owners can assign the owner role" },
        { status: 403 }
      );
    }

    // Admins cannot promote themselves or others to owner
    if (access.role === "admin" && role === "owner") {
      return NextResponse.json(
        { success: false, error: "Admins cannot assign the owner role" },
        { status: 403 }
      );
    }

    // Prevent role escalation: caller cannot assign a role higher than their own
    const roleHierarchy: Record<string, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
    if ((roleHierarchy[role] ?? 0) > (roleHierarchy[access.role] ?? 0)) {
      return NextResponse.json(
        { success: false, error: `Cannot assign a role higher than your own (${access.role})` },
        { status: 403 }
      );
    }

    // Prevent self-promotion
    if (user_id === access.user.id && roleHierarchy[role] > roleHierarchy[access.role]) {
      return NextResponse.json(
        { success: false, error: "Cannot promote yourself to a higher role" },
        { status: 403 }
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
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
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
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});
