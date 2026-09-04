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

    // Development: allow synthetic user ONLY if explicitly enabled via ALLOW_DEV_AUTH=true
    if (!isDevAuthAllowed()) {
      return {
        error: NextResponse.json(
          { success: false, error: "Authentication not configured. Set ALLOW_DEV_AUTH=true for development." },
          { status: 401 }
        ),
      };
    }

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
 * Get or create the user's personal workspace.
 * For V1: single user → single workspace → auto-resolved.
 * Creates a workspace + membership if user has none.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOrCreatePersonalWorkspace(
  serviceClient: any,
  userId: string
): Promise<{ workspaceId: string; role: WorkspaceRole } | null> {
  // 1. Check existing membership
  const { data: membership } = await serviceClient
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .order("workspace_id")
    .limit(1)
    .single();

  if (membership?.workspace_id) {
    return { workspaceId: membership.workspace_id, role: membership.role as WorkspaceRole };
  }

  // 2. No workspace — create personal workspace (V1 onboarding)
  const workspaceId = `ws-${userId.slice(0, 8)}-${Date.now()}`;

  // Create workspace
  const { error: wsError } = await serviceClient
    .from("workspaces")
    .insert({
      id: workspaceId,
      name: "My Workspace",
      description: "Personal workspace",
      target_country: "US",
      currency: "USD",
      target_margin: 3.0,
      supplier_countries: [],
      business_rules: {},
      approval_rules: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (wsError) {
    console.error("[Auth] Failed to create workspace:", wsError.message);
    return null;
  }

  // Create owner membership
  const { error: memError } = await serviceClient
    .from("workspace_members")
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: "owner",
    });

  if (memError) {
    console.error("[Auth] Failed to create membership:", memError.message);
    return null;
  }

  console.log(`[Auth] Created personal workspace ${workspaceId} for user ${userId}`);
  return { workspaceId, role: "owner" };
}

/**
 * Require workspace access with minimum role.
 * Returns 403 if user doesn't have access to the workspace.
 *
 * V1: Auto-resolves user's single workspace if not provided.
 * The browser does NOT need to supply workspaceId.
 */
export async function requireWorkspaceAccess(
  request: NextRequest,
  options: {
    workspaceId?: string;    // Optional: if provided, validates access to that specific workspace
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

  // If Supabase not configured, allow access (dev mode)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const wsId = options.workspaceId || "ws-default";
    return { user, workspaceId: wsId, role: "owner" };
  }

  // Dev synthetic user: skip DB membership check
  if (user.id === "local-dev") {
    const wsId = options.workspaceId || "ws-default";
    return { user, workspaceId: wsId, role: "owner" };
  }

  // Create service-role client for workspace resolution
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

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  let workspaceId: string;
  let role: WorkspaceRole;

  if (options.workspaceId) {
    // Specific workspace requested — validate membership
    workspaceId = options.workspaceId;

    const { data: membership, error: membershipError } = await serviceClient
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership) {
      return {
        error: NextResponse.json(
          { success: false, error: "Access denied: not a member of this workspace" },
          { status: 403 }
        ),
      };
    }

    role = membership.role as WorkspaceRole;
  } else {
    // V1: Auto-resolve user's single workspace
    const result = await getOrCreatePersonalWorkspace(serviceClient, user.id);
    if (!result) {
      return {
        error: NextResponse.json(
          { success: false, error: "Failed to resolve workspace" },
          { status: 500 }
        ),
      };
    }
    workspaceId = result.workspaceId;
    role = result.role;
  }

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
