-- AI Commerce Lab — Add Permissions System
-- Run this in Supabase SQL Editor

-- ============================================
-- AGENT PERMISSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS agent_permissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  granted BOOLEAN DEFAULT true,
  conditions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, action, target)
);

-- Add role column to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'restricted';

-- Set existing agents to 'admin' role
UPDATE agents SET role = 'admin' WHERE id = 'product-hunter';
UPDATE agents SET role = 'agent' WHERE id IN ('supplier-research', 'market-research', 'opportunity-scoring');

-- Enable RLS
ALTER TABLE agent_permissions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON agent_permissions FOR ALL USING (true);

-- Grant default permissions for product-hunter (admin)
INSERT INTO agent_permissions (agent_id, action, target, granted) VALUES
  ('product-hunter', 'execute', '*', true),
  ('product-hunter', 'call_tool', '*', true),
  ('product-hunter', 'use_provider', '*', true),
  ('product-hunter', 'read_data', '*', true),
  ('product-hunter', 'write_data', '*', true),
  ('product-hunter', 'access_agent', '*', true)
ON CONFLICT (agent_id, action, target) DO NOTHING;

-- Grant permissions for research agents (agent role)
INSERT INTO agent_permissions (agent_id, action, target, granted) VALUES
  ('supplier-research', 'execute', '*', true),
  ('supplier-research', 'call_tool', '*', true),
  ('supplier-research', 'use_provider', '*', true),
  ('supplier-research', 'read_data', '*', true),
  ('market-research', 'execute', '*', true),
  ('market-research', 'call_tool', '*', true),
  ('market-research', 'use_provider', '*', true),
  ('market-research', 'read_data', '*', true),
  ('opportunity-scoring', 'execute', '*', true),
  ('opportunity-scoring', 'call_tool', '*', true),
  ('opportunity-scoring', 'use_provider', '*', true),
  ('opportunity-scoring', 'read_data', '*', true)
ON CONFLICT (agent_id, action, target) DO NOTHING;
