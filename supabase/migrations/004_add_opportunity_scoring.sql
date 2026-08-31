-- AI Commerce Lab — Add Opportunity Scoring Agent
-- Run this in Supabase SQL Editor

-- Add Opportunity Scoring agent
INSERT INTO agents (id, name, description, enabled, status, version) VALUES
  ('opportunity-scoring', 'Opportunity Scoring', 'Combines product, supplier, and market data to score opportunities', true, 'ready', '0.1.0')
ON CONFLICT (id) DO NOTHING;

-- Default config for Opportunity Scoring
INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-opportunity-scoring', 'opportunity-scoring', 'gemini', 'gemini-3-flash', 0.2, 4096)
ON CONFLICT (agent_id) DO NOTHING;
