// Supabase Client
// Server-side Supabase client for database operations.
// Uses lazy initialization — throws on first USE, not on import.
// This allows tests to import this module without env vars.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function _getClient(): SupabaseClient {
  if (_client) return _client;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase environment variables. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  _client = createClient(supabaseUrl, supabaseServiceKey);
  return _client;
}

// Proxy that defers validation to first property access/call
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(_getClient(), prop, receiver);
  },
});

// Database types — single source of truth
// Export for use in new code; gradually replace untyped imports
export type { Database } from "@/lib/types/database";
