-- AI Commerce Lab — Add Store Builder Agent
-- Run this in Supabase SQL Editor

-- Add Store Builder agent
INSERT INTO agents (id, name, description, enabled, status, version, role) VALUES
  ('store-builder', 'Store Builder', 'Creates product listings and store content', true, 'ready', '0.1.0', 'agent')
ON CONFLICT (id) DO NOTHING;

-- Default config for Store Builder
INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-store-builder', 'store-builder', 'gemini', 'gemini-3-flash', 0.7, 4096)
ON CONFLICT (agent_id) DO NOTHING;

-- Store Builder permissions
INSERT INTO agent_permissions (agent_id, action, target, granted) VALUES
  ('store-builder', 'execute', '*', true),
  ('store-builder', 'call_tool', '*', true),
  ('store-builder', 'use_provider', '*', true),
  ('store-builder', 'read_data', '*', true)
ON CONFLICT (agent_id, action, target) DO NOTHING;
