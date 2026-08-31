-- FASE 4: Dynamic Provider Manager
-- Enhances ai_providers table with description, config, capabilities.
-- Makes providers configurable from DB instead of hardcoded.

-- ============================================
-- NEW COLUMNS
-- ============================================

-- Provider description for UI display
ALTER TABLE ai_providers ADD COLUMN description TEXT;

-- Environment variable name that holds the API key (e.g., 'GEMINI_API_KEY')
ALTER TABLE ai_providers ADD COLUMN api_key_env_var TEXT;

-- Base URL for API calls (provider-specific)
ALTER TABLE ai_providers ADD COLUMN base_url TEXT;

-- Provider capabilities (e.g., '["text", "json", "vision"]')
ALTER TABLE ai_providers ADD COLUMN capabilities TEXT[] DEFAULT '{}';

-- Provider configuration (rate limits, timeouts, etc.)
ALTER TABLE ai_providers ADD COLUMN config JSONB DEFAULT '{}';

-- ============================================
-- SEED ENHANCED DATA
-- ============================================

UPDATE ai_providers SET
  description = 'Google Gemini — fast, cost-effective, large context window',
  api_key_env_var = 'GEMINI_API_KEY',
  base_url = 'https://generativelanguage.googleapis.com/v1beta',
  capabilities = '{text,json,vision}',
  config = '{"max_tokens": 8192, "rate_limit_rpm": 60}'::jsonb
WHERE slug = 'gemini';

UPDATE ai_providers SET
  description = 'Anthropic Claude — highest quality, best for complex reasoning',
  api_key_env_var = 'ANTHROPIC_API_KEY',
  base_url = 'https://api.anthropic.com/v1',
  capabilities = '{text,json,vision,tool_use}',
  config = '{"max_tokens": 8192, "rate_limit_rpm": 30}'::jsonb
WHERE slug = 'anthropic';

UPDATE ai_providers SET
  description = 'xAI Grok — fast, good for real-time data',
  api_key_env_var = 'XAI_API_KEY',
  base_url = 'https://api.x.ai/v1',
  capabilities = '{text,json}',
  config = '{"max_tokens": 4096, "rate_limit_rpm": 30}'::jsonb
WHERE slug = 'xai';

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_providers_slug ON ai_providers(slug);
CREATE INDEX idx_providers_enabled ON ai_providers(enabled);
