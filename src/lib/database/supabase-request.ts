// Supabase Request Client
// Creates a session-scoped Supabase client from a NextRequest.
// Use this in API routes instead of the service-role client
// when accessing user-facing data. RLS will be enforced.

import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";

/**
 * Create a Supabase client scoped to the user's session from a request.
 * This client enforces RLS policies — users can only see their workspace data.
 *
 * Returns null if Supabase is not configured or session is invalid.
 *
 * Usage in API routes:
 * ```ts
 * const client = await createRequestClient(request);
 * if (!client) return errorResponse;
 * const { data } = await client.from("agents").select("*");
 * ```
 */
export async function createRequestClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
       
      setAll(_cookiesToSet) {
        // No-op in route handlers — cookies are set on response
      },
    },
  });

  // Verify the session is valid
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return null;
  }

  return client;
}
