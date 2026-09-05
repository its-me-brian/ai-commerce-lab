-- AI Commerce Lab — Add Finance Agent
-- Run this in Supabase SQL Editor

-- Add Finance agent
INSERT INTO agents (id, name, description, enabled, status, version, role) VALUES
  ('finance', 'Finance Agent', 'Tracks costs, margins, and profitability', true, 'ready', '0.1.0', 'agent')
ON CONFLICT (id) DO NOTHING;

-- Default config for Finance
INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-finance', 'finance', 'gemini', 'gemini-3-flash', 0.2, 4096)
ON CONFLICT (agent_id) DO NOTHING;

-- Finance permissions
INSERT INTO agent_permissions (agent_id, action, target, granted) VALUES
  ('finance', 'execute', '*', true),
  ('finance', 'call_tool', '*', true),
  ('finance', 'use_provider', '*', true),
  ('finance', 'read_data', '*', true)
ON CONFLICT (agent_id, action, target) DO NOTHING;
