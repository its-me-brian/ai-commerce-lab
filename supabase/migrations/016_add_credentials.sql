-- FASE 5: Secure Credential Manager
-- Stores encrypted API keys in database.
-- Keys are encrypted at rest and never exposed to the browser.

-- ============================================
-- CREDENTIALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_provider_credentials (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- Human-readable name (e.g., "Production Key")
  encrypted_key TEXT NOT NULL,           -- AES-256-GCM encrypted API key
  key_hint TEXT,                         -- Last 4 chars for UI identification (e.g., "sk-1234")
  iv TEXT NOT NULL,                      -- Initialization vector for decryption
  auth_tag TEXT NOT NULL,                -- Authentication tag for GCM verification
  environment TEXT DEFAULT 'production', -- production | staging | development
  is_active BOOLEAN DEFAULT true,       -- Only one active credential per provider+environment
  expires_at TIMESTAMPTZ,               -- Optional expiration
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT                        -- Who created this credential
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_credentials_provider ON ai_provider_credentials(provider_id);
CREATE INDEX idx_credentials_active ON ai_provider_credentials(is_active);
CREATE INDEX idx_credentials_env ON ai_provider_credentials(environment);

-- Unique constraint: one active credential per provider+environment
CREATE UNIQUE INDEX idx_credentials_unique_active
  ON ai_provider_credentials(provider_id, environment)
  WHERE is_active = true;

-- ============================================
-- RLS
-- ============================================
ALTER TABLE ai_provider_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON ai_provider_credentials FOR ALL USING (true);

-- ============================================
-- SEED: Link existing env var credentials
-- ============================================
-- This is a placeholder — actual credentials are loaded at runtime
-- The table structure is ready for encrypted storage
