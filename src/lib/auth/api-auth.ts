// API Auth Helper
// Utility functions for authenticating API routes.

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

/**
 * Get the authenticated user from the request.
 * Returns null if not authenticated.
 */
export async function getAuthUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op in route handlers
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
  };
}

/**
 * Require authentication. Returns 401 if not authenticated.
 */
export async function requireAuth(request: NextRequest): Promise<
  { user: AuthenticatedUser } | { error: NextResponse }
> {
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
