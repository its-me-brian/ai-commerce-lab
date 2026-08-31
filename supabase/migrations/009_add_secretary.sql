-- AI Commerce Lab — Add Secretary Agent
-- Run this in Supabase SQL Editor

-- Add Secretary agent
INSERT INTO agents (id, name, description, enabled, status, version, role) VALUES
  ('secretary', 'Secretary Agent', 'Manages supplier communication and relationships', true, 'ready', '0.1.0', 'agent')
ON CONFLICT (id) DO NOTHING;

-- Default config for Secretary
INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-secretary', 'secretary', 'gemini', 'gemini-3-flash', 0.3, 4096)
ON CONFLICT (agent_id) DO NOTHING;

-- Secretary permissions
INSERT INTO agent_permissions (agent_id, action, target, granted) VALUES
  ('secretary', 'execute', '*', true),
  ('secretary', 'call_tool', '*', true),
  ('secretary', 'use_provider', '*', true),
  ('secretary', 'read_data', '*', true)
ON CONFLICT (agent_id, action, target) DO NOTHING;
