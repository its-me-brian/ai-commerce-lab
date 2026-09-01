// Supabase Client
// Server-side Supabase client for database operations.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing Supabase environment variables. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
}

// Server-side client with service role key (full access)
// TODO(FASE B): Add <Database> generic once all API routes are updated to use typed queries
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Database types — single source of truth
// Export for use in new code; gradually replace untyped imports
export type { Database } from "@/lib/types/database";
