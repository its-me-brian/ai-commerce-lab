// Supabase Server Client
// Cookie-based Supabase client for Server Components and Route Handlers.
// Uses @supabase/ssr for proper cookie handling in Next.js App Router.

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
 * Resolution chain:
 * 1. Supabase not configured → "ws-default" (dev mode)
 * 2. No session → "ws-default" (dev mode)
 * 3. local-dev user → "ws-default" (dev shortcut)
 * 4. Real user → look up workspace_members → return first workspace_id
 * 5. No membership → "ws-default" (fallback)
 */
export async function getWorkspaceId(): Promise<string> {
  const client = await createClient();

  // Supabase not configured — dev mode
  if (!client) return "ws-default";

  const { data: { user } } = await client.auth.getUser();

  // No session — dev mode
  if (!user) return "ws-default";

  // Dev shortcut
  if (user.id === "local-dev") return "ws-default";

  // Look up workspace membership via service-role client
  const { createClient: createServiceClient } = await import("@supabase/supabase-js");
  const serviceUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceUrl || !serviceKey) return "ws-default";

  const serviceClient = createServiceClient(serviceUrl, serviceKey);

  const { data: membership } = await serviceClient
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("workspace_id")
    .limit(1)
    .single();

  return membership?.workspace_id || "ws-default";
}
