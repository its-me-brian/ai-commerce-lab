// Supabase Server Client
// Cookie-based Supabase client for Server Components and Route Handlers.
// Uses @supabase/ssr for proper cookie handling in Next.js App Router.

import { logger } from "../logging";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Create a Supabase client that reads auth session from cookies.
 * Returns null if Supabase env vars are not configured.
 * Use this in Server Components, Route Handlers, and Server Actions.
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
    },
  });
}

/**
 * Get the workspace_id for the current user from cookies.
 * Used by Server Components to scope queries by workspace.
 *
 * V1: Auto-resolves user's single workspace.
 * Creates a personal workspace if user has none (onboarding).
 * No fallback to ws-default in production.
 */
export async function getWorkspaceId(): Promise<string> {
  const client = await createClient();

  // Supabase not configured — dev mode only
  if (!client) {
    if (process.env.NODE_ENV === "production") {
      logger.error("[WorkspaceId] Supabase not configured in production");
      throw new Error("Supabase not configured");
    }
    return "ws-default";
  }

  const { data: { user } } = await client.auth.getUser();

  // No session — dev mode only
  if (!user) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("No authenticated session");
    }
    return "ws-default";
  }

  // Dev shortcut
  if (user.id === "local-dev") return "ws-default";

  // Look up workspace membership via service-role client
  const { createClient: createServiceClient } = await import("@supabase/supabase-js");
  const serviceUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceUrl || !serviceKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing Supabase service credentials");
    }
    return "ws-default";
  }

  const serviceClient = createServiceClient(serviceUrl, serviceKey);

  // Check existing membership
  const { data: membership } = await serviceClient
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("workspace_id")
    .limit(1)
    .single();

  if (membership?.workspace_id) {
    return membership.workspace_id;
  }

  // V1 onboarding: create personal workspace if user has none
  const workspaceId = `ws-${user.id.slice(0, 8)}-${Date.now()}`;

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
    logger.error("[WorkspaceId] Failed to create workspace:", { error: String(wsError.message) });
    throw new Error("Failed to create workspace");
  }

  const { error: memError } = await serviceClient
    .from("workspace_members")
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: "owner",
    });

  if (memError) {
    logger.error("[WorkspaceId] Failed to create membership:", { error: String(memError.message) });
    throw new Error("Failed to create workspace membership");
  }

  logger.info(`[WorkspaceId] Created personal workspace  for user ${user.id}`, { value: workspaceId });
  return workspaceId;
}
