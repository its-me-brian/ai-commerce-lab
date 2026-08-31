-- AI Commerce Lab — Add Market Research Agent
-- Run this in Supabase SQL Editor

-- Add Market Research agent
INSERT INTO agents (id, name, description, enabled, status, version) VALUES
  ('market-research', 'Market Research', 'Analyzes market trends, competition, and demand', true, 'ready', '0.1.0')
ON CONFLICT (id) DO NOTHING;

-- Default config for Market Research
INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-market-research', 'market-research', 'gemini', 'gemini-3-flash', 0.3, 4096)
ON CONFLICT (agent_id) DO NOTHING;
