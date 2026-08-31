-- Migration 013: Add workspaces table
-- Company/entity that represents the user's business
-- All agents, tasks, and data will be scoped to a workspace.

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  target_country TEXT NOT NULL DEFAULT 'ES',
  currency TEXT NOT NULL DEFAULT 'EUR',
  target_customer TEXT,
  brand_voice TEXT,
  target_margin DECIMAL(5,2) NOT NULL DEFAULT 3.0,
  supplier_countries JSONB NOT NULL DEFAULT '[]'::jsonb,
  business_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_created_at ON workspaces(created_at);

-- Insert default workspace
INSERT INTO workspaces (id, name, description, target_country, currency, target_customer, brand_voice, target_margin, supplier_countries)
VALUES (
  'ws-default',
  'AI Commerce Lab Store',
  'Default workspace for AI Commerce Lab',
  'ES',
  'EUR',
  'European consumers aged 25-45',
  'Professional, evidence-based, concise',
  3.0,
  '["IT", "ES", "DE"]'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON workspaces FOR ALL USING (true);
