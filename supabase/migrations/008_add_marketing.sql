-- AI Commerce Lab — Add Marketing Agent
-- Run this in Supabase SQL Editor

-- Add Marketing agent
INSERT INTO agents (id, name, description, enabled, status, version, role) VALUES
  ('marketing', 'Marketing Agent', 'Generates ad copy, hooks, and campaigns', true, 'ready', '0.1.0', 'agent')
ON CONFLICT (id) DO NOTHING;

-- Default config for Marketing
INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-marketing', 'marketing', 'gemini', 'gemini-3-flash', 0.8, 8192)
ON CONFLICT (agent_id) DO NOTHING;

-- Marketing permissions
INSERT INTO agent_permissions (agent_id, action, target, granted) VALUES
  ('marketing', 'execute', '*', true),
  ('marketing', 'call_tool', '*', true),
  ('marketing', 'use_provider', '*', true),
  ('marketing', 'read_data', '*', true)
ON CONFLICT (agent_id, action, target) DO NOTHING;
