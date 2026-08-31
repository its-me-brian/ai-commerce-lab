-- AI Commerce Lab — Add Supplier Research Agent
-- Run this in Supabase SQL Editor

-- Add Supplier Research agent
INSERT INTO agents (id, name, description, enabled, status, version) VALUES
  ('supplier-research', 'Supplier Research', 'Researches and evaluates suppliers for product sourcing', true, 'ready', '0.1.0')
ON CONFLICT (id) DO NOTHING;

-- Default config for Supplier Research (use same model as Product Hunter)
INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-supplier-research', 'supplier-research', 'gemini', 'gemini-3-flash', 0.3, 4096)
ON CONFLICT (agent_id) DO NOTHING;
