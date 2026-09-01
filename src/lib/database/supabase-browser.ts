// Supabase Browser Client
// Client-side Supabase client for Realtime subscriptions.
// Uses NEXT_PUBLIC env vars (safe for browser).

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Lazy singleton — only created when first accessed
let browserClient: ReturnType<typeof createClient> | null = null;

export function getBrowserClient() {
  if (browserClient) return browserClient;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Gracefully degrade — realtime won't work but app still functions
    console.warn(
      "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Realtime disabled."
    );
    return null;
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey);
  return browserClient;
}
