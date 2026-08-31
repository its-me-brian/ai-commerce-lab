-- Migration 018: Agent Model Routes (Model Pool)
-- FASE 9: Each agent can route to multiple models with priority and policy.
-- Policies: priority (use highest priority), cheapest (lowest cost), fastest (lowest latency)

CREATE TABLE IF NOT EXISTS agent_model_routes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,            -- Lower = higher priority (0 = highest)
  policy TEXT DEFAULT 'priority',        -- priority | cheapest | fastest
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, model_id)
);

-- Seed: Product Hunter gets Gemini as primary, Claude as fallback
INSERT INTO agent_model_routes (agent_id, model_id, priority, policy, enabled) VALUES
  ('product-hunter', 'gemini-3-flash', 0, 'priority', true),
  ('product-hunter', 'claude-3-5-haiku', 1, 'priority', true)
ON CONFLICT (agent_id, model_id) DO NOTHING;

-- Seed: CEO gets Claude Sonnet as primary
INSERT INTO agent_model_routes (agent_id, model_id, priority, policy, enabled) VALUES
  ('ceo', 'claude-sonnet-4', 0, 'priority', true),
  ('ceo', 'gemini-3-flash', 1, 'priority', true)
ON CONFLICT (agent_id, model_id) DO NOTHING;

-- Seed: Secretary uses cheapest policy
INSERT INTO agent_model_routes (agent_id, model_id, priority, policy, enabled) VALUES
  ('secretary', 'gemini-3-flash', 0, 'cheapest', true),
  ('secretary', 'claude-3-5-haiku', 1, 'cheapest', true)
ON CONFLICT (agent_id, model_id) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_model_routes_agent ON agent_model_routes(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_model_routes_model ON agent_model_routes(model_id);

-- RLS
ALTER TABLE agent_model_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON agent_model_routes FOR ALL USING (true);
