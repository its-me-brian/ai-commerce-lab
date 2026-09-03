// Supabase Browser Client
// Client-side Supabase client with cookie-based session persistence.
// Uses @supabase/ssr createBrowserClient so sessions survive full page reloads.

import { createBrowserClient } from "@supabase/ssr";

// Lazy singleton — only created when first accessed
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserClient() {
  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Gracefully degrade — realtime won't work but app still functions
    console.warn(
      "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Realtime disabled."
    );
    return null;
  }

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
