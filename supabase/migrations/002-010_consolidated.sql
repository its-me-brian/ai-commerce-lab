-- ============================================
-- AI Commerce Lab — Consolidated Migrations 002-010
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 002: Supplier Research Agent
-- ============================================
INSERT INTO agents (id, name, description, enabled, status, version) VALUES
  ('supplier-research', 'Supplier Research', 'Researches and evaluates suppliers for product sourcing', true, 'ready', '0.1.0')
ON CONFLICT (id) DO UPDATE SET enabled = true, status = 'ready', version = '0.1.0';

INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-supplier-research', 'supplier-research', 'gemini', 'gemini-3-flash', 0.3, 4096)
ON CONFLICT (agent_id) DO NOTHING;

-- ============================================
-- 003: Market Research Agent
-- ============================================
INSERT INTO agents (id, name, description, enabled, status, version) VALUES
  ('market-research', 'Market Research', 'Analyzes market trends, competition, and demand', true, 'ready', '0.1.0')
ON CONFLICT (id) DO UPDATE SET enabled = true, status = 'ready', version = '0.1.0';

INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-market-research', 'market-research', 'gemini', 'gemini-3-flash', 0.3, 4096)
ON CONFLICT (agent_id) DO NOTHING;

-- ============================================
-- 004: Opportunity Scoring Agent
-- ============================================
INSERT INTO agents (id, name, description, enabled, status, version) VALUES
  ('opportunity-scoring', 'Opportunity Scoring', 'Combines product, supplier, and market data to score opportunities', true, 'ready', '0.1.0')
ON CONFLICT (id) DO UPDATE SET enabled = true, status = 'ready', version = '0.1.0';

INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-opportunity-scoring', 'opportunity-scoring', 'gemini', 'gemini-3-flash', 0.2, 4096)
ON CONFLICT (agent_id) DO NOTHING;

-- ============================================
-- 005: Permissions System
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

ALTER TABLE agents ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'restricted';

-- Set roles
UPDATE agents SET role = 'admin' WHERE id = 'product-hunter';
UPDATE agents SET role = 'agent' WHERE id IN ('supplier-research', 'market-research', 'opportunity-scoring', 'store-builder', 'marketing', 'secretary', 'finance');
UPDATE agents SET role = 'admin' WHERE id = 'ceo';

-- Enable RLS
ALTER TABLE agent_permissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Service role full access" ON agent_permissions FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 006: CEO Agent
-- ============================================
INSERT INTO agents (id, name, description, enabled, status, version, role) VALUES
  ('ceo', 'CEO Agent', 'Orchestrates all agents to achieve high-level ecommerce goals', true, 'ready', '0.1.0', 'admin')
ON CONFLICT (id) DO UPDATE SET enabled = true, status = 'ready', version = '0.1.0', role = 'admin';

INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-ceo', 'ceo', 'gemini', 'gemini-3-flash', 0.4, 8192)
ON CONFLICT (agent_id) DO NOTHING;

INSERT INTO agent_permissions (agent_id, action, target, granted) VALUES
  ('ceo', 'execute', '*', true),
  ('ceo', 'call_tool', '*', true),
  ('ceo', 'use_provider', '*', true),
  ('ceo', 'read_data', '*', true),
  ('ceo', 'write_data', '*', true),
  ('ceo', 'access_agent', '*', true)
ON CONFLICT (agent_id, action, target) DO NOTHING;

-- ============================================
-- 007: Store Builder Agent
-- ============================================
INSERT INTO agents (id, name, description, enabled, status, version, role) VALUES
  ('store-builder', 'Store Builder', 'Creates product listings and store content', true, 'ready', '0.1.0', 'agent')
ON CONFLICT (id) DO UPDATE SET enabled = true, status = 'ready', version = '0.1.0', role = 'agent';

INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-store-builder', 'store-builder', 'gemini', 'gemini-3-flash', 0.7, 4096)
ON CONFLICT (agent_id) DO NOTHING;

INSERT INTO agent_permissions (agent_id, action, target, granted) VALUES
  ('store-builder', 'execute', '*', true),
  ('store-builder', 'call_tool', '*', true),
  ('store-builder', 'use_provider', '*', true),
  ('store-builder', 'read_data', '*', true)
ON CONFLICT (agent_id, action, target) DO NOTHING;

-- ============================================
-- 008: Marketing Agent
-- ============================================
INSERT INTO agents (id, name, description, enabled, status, version, role) VALUES
  ('marketing', 'Marketing Agent', 'Generates ad copy, hooks, and campaigns', true, 'ready', '0.1.0', 'agent')
ON CONFLICT (id) DO UPDATE SET enabled = true, status = 'ready', version = '0.1.0', role = 'agent';

INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-marketing', 'marketing', 'gemini', 'gemini-3-flash', 0.8, 8192)
ON CONFLICT (agent_id) DO NOTHING;

INSERT INTO agent_permissions (agent_id, action, target, granted) VALUES
  ('marketing', 'execute', '*', true),
  ('marketing', 'call_tool', '*', true),
  ('marketing', 'use_provider', '*', true),
  ('marketing', 'read_data', '*', true)
ON CONFLICT (agent_id, action, target) DO NOTHING;

-- ============================================
-- 009: Secretary Agent
-- ============================================
INSERT INTO agents (id, name, description, enabled, status, version, role) VALUES
  ('secretary', 'Secretary Agent', 'Manages supplier communication and relationships', true, 'ready', '0.1.0', 'agent')
ON CONFLICT (id) DO UPDATE SET enabled = true, status = 'ready', version = '0.1.0', role = 'agent';

INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-secretary', 'secretary', 'gemini', 'gemini-3-flash', 0.3, 4096)
ON CONFLICT (agent_id) DO NOTHING;

INSERT INTO agent_permissions (agent_id, action, target, granted) VALUES
  ('secretary', 'execute', '*', true),
  ('secretary', 'call_tool', '*', true),
  ('secretary', 'use_provider', '*', true),
  ('secretary', 'read_data', '*', true)
ON CONFLICT (agent_id, action, target) DO NOTHING;

-- ============================================
-- 010: Finance Agent
-- ============================================
INSERT INTO agents (id, name, description, enabled, status, version, role) VALUES
  ('finance', 'Finance Agent', 'Tracks costs, margins, and profitability', true, 'ready', '0.1.0', 'agent')
ON CONFLICT (id) DO UPDATE SET enabled = true, status = 'ready', version = '0.1.0', role = 'agent';

INSERT INTO agent_configs (id, agent_id, primary_provider_id, primary_model_id, temperature, max_output_tokens) VALUES
  ('config-finance', 'finance', 'gemini', 'gemini-3-flash', 0.2, 4096)
ON CONFLICT (agent_id) DO NOTHING;

INSERT INTO agent_permissions (agent_id, action, target, granted) VALUES
  ('finance', 'execute', '*', true),
  ('finance', 'call_tool', '*', true),
  ('finance', 'use_provider', '*', true),
  ('finance', 'read_data', '*', true)
ON CONFLICT (agent_id, action, target) DO NOTHING;

-- ============================================
-- Fix existing agents (update status from development to ready)
-- ============================================
UPDATE agents SET enabled = true, status = 'ready', role = 'admin' WHERE id = 'product-hunter';
UPDATE agents SET enabled = true, status = 'ready', role = 'admin' WHERE id = 'ceo';

-- ============================================
-- Default permissions for product-hunter (admin)
-- ============================================
INSERT INTO agent_permissions (agent_id, action, target, granted) VALUES
  ('product-hunter', 'execute', '*', true),
  ('product-hunter', 'call_tool', '*', true),
  ('product-hunter', 'use_provider', '*', true),
  ('product-hunter', 'read_data', '*', true),
  ('product-hunter', 'write_data', '*', true),
  ('product-hunter', 'access_agent', '*', true)
ON CONFLICT (agent_id, action, target) DO NOTHING;
