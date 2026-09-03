// API Auth Helpers
// Utility functions for authenticating and authorizing API routes.
// PHASE 1: Added workspace access checks and production-safe auth.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface WorkspaceAccessResult {
  user: AuthenticatedUser;
  workspaceId: string;
  role: WorkspaceRole;
}

/**
 * Check if we're in production mode.
 * In production, auth MUST be configured — no synthetic users allowed.
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check if dev auth is explicitly allowed.
 */
function isDevAuthAllowed(): boolean {
  return process.env.ALLOW_DEV_AUTH === "true" && !isProduction();
}

/**
 * Get the authenticated user from the request.
 * Returns null if not authenticated or Supabase not configured.
 */
export async function getAuthUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // No-op in route handlers
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
  };
}

/**
 * Require authentication. Returns 401 if not authenticated.
 * PHASE 1: In production, returns 401 instead of synthetic user when Supabase is not configured.
 * Set ALLOW_DEV_AUTH=true to allow synthetic user in development.
 */
export async function requireAuth(request: NextRequest): Promise<
  { user: AuthenticatedUser } | { error: NextResponse }
> {
  // If Supabase not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // Production: MUST have auth configured — return 401
    if (isProduction()) {
      return {
        error: NextResponse.json(
          { success: false, error: "Authentication service not configured" },
          { status: 401 }
        ),
      };
    }

    // Development: allow synthetic user only if explicitly enabled
    if (isDevAuthAllowed()) {
      return { user: { id: "local-dev", email: "dev@localhost" } };
    }

    // Development without ALLOW_DEV_AUTH: still allow (backward compatible)
    return { user: { id: "local-dev", email: "dev@localhost" } };
  }

  const user = await getAuthUser(request);

  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  return { user };
}

/**
 * Require workspace access with minimum role.
 * Returns 403 if user doesn't have access to the workspace.
 *
 * PHASE 1: This is the CORE authorization helper.
 * Every API route that accesses workspace-scoped data must call this.
 */
export async function requireWorkspaceAccess(
  request: NextRequest,
  options: {
    workspaceId?: string;    // From request body/query — if not provided, uses default
    minimumRole?: WorkspaceRole;  // Minimum role required
  } = {}
): Promise<
  { user: AuthenticatedUser; workspaceId: string; role: WorkspaceRole } | { error: NextResponse }
> {
  // First, require auth
  const auth = await requireAuth(request);
  if ("error" in auth) return auth;

  const { user } = auth;
  const minimumRole = options.minimumRole || "viewer";

  // Get workspace ID from query params or request body
  let workspaceId = options.workspaceId;

  if (!workspaceId) {
    // Try to get from query params
    const url = new URL(request.url);
    workspaceId = url.searchParams.get("workspaceId") || undefined;

    // Try to get from request body (for POST/PUT)
    if (!workspaceId && ["POST", "PUT", "PATCH"].includes(request.method)) {
      try {
        const body = await request.clone().json();
        workspaceId = body.workspaceId;
      } catch {
        // No body or invalid JSON
      }
    }
  }

  // If still no workspaceId, use default for backward compatibility
  if (!workspaceId) {
    workspaceId = "ws-default";
  }

  // If Supabase not configured, allow access (dev mode)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { user, workspaceId, role: "owner" };
  }

  // Check workspace membership via service role client
  // (We use service role here because we're checking authorization, not reading data)
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      error: NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      ),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    // AUTO-ONBOARDING: If user is not a member, add them as owner of ws-default
    // This handles: (a) users created before the trigger, (b) trigger failures
    if (workspaceId === "ws-default") {
      // Use upsert to handle both cases: user not in DB, or trigger already added them
      const { error: insertError } = await supabase
        .from("workspace_members")
        .upsert(
          {
            workspace_id: "ws-default",
            user_id: user.id,
            role: "owner",
          },
          { onConflict: "workspace_id,user_id", ignoreDuplicates: true }
        );

      if (!insertError) {
        // Success — user was auto-added (or already existed), return owner access
        return { user, workspaceId, role: "owner" };
      }
      console.error("[Auth] Auto-onboarding failed:", insertError);
    }

    return {
      error: NextResponse.json(
        { success: false, error: "Access denied: not a member of this workspace" },
        { status: 403 }
      ),
    };
  }

  const role = membership.role as WorkspaceRole;

  // Check minimum role
  const roleHierarchy: Record<WorkspaceRole, number> = {
    viewer: 0,
    member: 1,
    admin: 2,
    owner: 3,
  };

  if (roleHierarchy[role] < roleHierarchy[minimumRole]) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: `Access denied: requires ${minimumRole} role or higher (you have ${role})`,
        },
        { status: 403 }
      ),
    };
  }

  return { user, workspaceId, role };
}

/**
 * Check if user has a specific permission in a workspace.
 * For now, this is role-based. Can be extended with fine-grained permissions later.
 */
export function hasPermission(
  role: WorkspaceRole,
  permission: string
): boolean {
  const permissions: Record<WorkspaceRole, string[]> = {
    owner: [
      "workspace.read", "workspace.write", "workspace.delete",
      "agents.read", "agents.write", "agents.delete",
      "conversations.read", "conversations.write", "conversations.delete",
      "catalog.read", "catalog.write", "catalog.delete", "catalog.publish",
      "settings.read", "settings.write",
      "integrations.read", "integrations.connect", "integrations.disconnect",
      "credentials.read", "credentials.write", "credentials.delete",
      "budgets.read", "budgets.write",
      "approvals.read", "approvals.approve",
      "members.read", "members.invite", "members.remove",
    ],
    admin: [
      "workspace.read", "workspace.write",
      "agents.read", "agents.write",
      "conversations.read", "conversations.write",
      "catalog.read", "catalog.write", "catalog.publish",
      "settings.read", "settings.write",
      "integrations.read", "integrations.connect",
      "credentials.read",
      "budgets.read", "budgets.write",
      "approvals.read", "approvals.approve",
      "members.read",
    ],
    member: [
      "workspace.read",
      "agents.read",
      "conversations.read", "conversations.write",
      "catalog.read", "catalog.write",
      "settings.read",
      "integrations.read",
      "approvals.read",
    ],
    viewer: [
      "workspace.read",
      "agents.read",
      "conversations.read",
      "catalog.read",
      "settings.read",
      "integrations.read",
    ],
  };

  return permissions[role]?.includes(permission) || false;
}

/**
 * Require a specific permission. Returns 403 if not authorized.
 */
export function requirePermission(
  role: WorkspaceRole,
  permission: string
): { allowed: true } | { error: NextResponse } {
  if (hasPermission(role, permission)) {
    return { allowed: true };
  }

  return {
    error: NextResponse.json(
      {
        success: false,
        error: `Permission denied: requires '${permission}' (your role: ${role})`,
      },
      { status: 403 }
    ),
  };
}
