-- 052: Add used_nonces table for distributed OAuth nonce tracking
-- Replaces in-memory Map that doesn't survive across Vercel instances

CREATE TABLE IF NOT EXISTS used_nonces (
  nonce TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-cleanup expired nonces (10 min TTL)
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS void AS $$
BEGIN
  DELETE FROM used_nonces WHERE created_at < now() - interval '10 minutes';
END;
$$ LANGUAGE plpgsql;

-- RLS: only service role can access (internal system table)
ALTER TABLE used_nonces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON used_nonces
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for cleanup performance
CREATE INDEX idx_used_nonces_created_at ON used_nonces (created_at);
