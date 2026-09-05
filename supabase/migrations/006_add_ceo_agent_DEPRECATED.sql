-- AI Commerce Lab — Add CEO Agent
-- Run this in Supabase SQL Editor

-- Add CEO agent
INSERT INTO agents (id, name, description, enabled, status, version, role) VALUES
  ('ceo', 'CEO Agent', 'Orchestrates all agents to achieve high-level ecommerce goals', true, 'ready', '0.1.0', 'admin')
ON CONFLICT (id) DO NOTHING;

-- Default config for CEO
INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-ceo', 'ceo', 'gemini', 'gemini-3-flash', 0.4, 8192)
ON CONFLICT (agent_id) DO NOTHING;

-- CEO permissions (admin role - full access)
INSERT INTO agent_permissions (agent_id, action, target, granted) VALUES
  ('ceo', 'execute', '*', true),
  ('ceo', 'call_tool', '*', true),
  ('ceo', 'use_provider', '*', true),
  ('ceo', 'read_data', '*', true),
  ('ceo', 'write_data', '*', true),
  ('ceo', 'access_agent', '*', true)
ON CONFLICT (agent_id, action, target) DO NOTHING;
