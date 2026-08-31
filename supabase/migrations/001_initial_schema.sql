-- AI Commerce Lab — Initial Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- PROVIDERS
-- ============================================
CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- MODELS
-- ============================================
CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  context_window INTEGER DEFAULT 200000,
  input_price DECIMAL(10,4) DEFAULT 0,
  output_price DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- AGENTS
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'development',
  version TEXT DEFAULT '0.1.0',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- AGENT CONFIGS
-- ============================================
CREATE TABLE IF NOT EXISTS agent_configs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  primary_provider_id TEXT NOT NULL REFERENCES ai_providers(id),
  primary_model_id TEXT NOT NULL REFERENCES ai_models(id),
  fallback_provider_id TEXT REFERENCES ai_providers(id),
  fallback_model_id TEXT REFERENCES ai_models(id),
  temperature DECIMAL(3,2) DEFAULT 0.2,
  max_output_tokens INTEGER DEFAULT 4096,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id)
);

-- ============================================
-- AGENT TASKS
-- ============================================
CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  task_type TEXT DEFAULT 'general',
  input JSONB NOT NULL,
  output JSONB,
  priority INTEGER DEFAULT 5,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ============================================
-- AGENT RUNS
-- ============================================
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INITIAL DATA
-- ============================================

-- Providers
INSERT INTO ai_providers (id, name, slug, enabled) VALUES
  ('gemini', 'Google Gemini', 'gemini', true),
  ('anthropic', 'Anthropic Claude', 'anthropic', false),
  ('xai', 'xAI Grok', 'xai', false)
ON CONFLICT (id) DO NOTHING;

-- Models
INSERT INTO ai_models (id, provider_id, name, model_id, enabled, context_window, input_price, output_price) VALUES
  ('gemini-3-flash', 'gemini', 'Gemini 3 Flash', 'gemini-3-flash-preview', true, 1000000, 0, 0),
  ('claude-3-5-haiku', 'anthropic', 'Claude 3.5 Haiku', 'claude-3-5-haiku-20241022', false, 200000, 0.80, 4.00),
  ('claude-sonnet-4', 'anthropic', 'Claude Sonnet 4', 'claude-sonnet-4-20250514', false, 200000, 3.00, 15.00),
  ('grok-3-mini', 'xai', 'Grok 3 Mini', 'grok-3-mini-latest', false, 128000, 0.30, 0.50)
ON CONFLICT (id) DO NOTHING;

-- Agent
INSERT INTO agents (id, name, description, enabled, status, version) VALUES
  ('product-hunter', 'Product Hunter', 'Searches and evaluates ecommerce opportunities', true, 'ready', '0.1.0'),
  ('store-builder', 'Store Builder', 'Creates product listings and store content', false, 'development', '0.1.0'),
  ('marketing', 'Marketing Agent', 'Generates ad copy, hooks, and campaigns', false, 'development', '0.1.0'),
  ('secretary', 'Secretary Agent', 'Manages supplier communication', false, 'development', '0.1.0'),
  ('finance', 'Finance Agent', 'Tracks costs, margins, and profitability', false, 'development', '0.1.0'),
  ('ceo', 'CEO Agent', 'Orchestrates all agents and decisions', false, 'development', '0.1.0')
ON CONFLICT (id) DO NOTHING;

-- Default config for Product Hunter
INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-product-hunter', 'product-hunter', 'gemini', 'gemini-3-flash', 0.2, 4096)
ON CONFLICT (agent_id) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON ai_providers FOR ALL USING (true);
CREATE POLICY "Service role full access" ON ai_models FOR ALL USING (true);
CREATE POLICY "Service role full access" ON agents FOR ALL USING (true);
CREATE POLICY "Service role full access" ON agent_configs FOR ALL USING (true);
CREATE POLICY "Service role full access" ON agent_tasks FOR ALL USING (true);
CREATE POLICY "Service role full access" ON agent_runs FOR ALL USING (true);
