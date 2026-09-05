-- Migration 046: Rate Limits Table
-- Persistent rate limiting storage for API routes.
-- Replaces in-memory Map-based rate limiter with database-backed storage.
-- Idempotent: safe to re-run if partially applied.

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at ON rate_limits(created_at);

-- Row Level Security
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role has full access
DO $$ BEGIN
  CREATE POLICY "Service role full access" ON rate_limits
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Authenticated users can insert their own rate limit entries
DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert" ON rate_limits
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Auto-cleanup: Delete entries older than 1 hour
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE created_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql;
