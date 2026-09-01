-- Migration 028: Workflow Definitions from DB
-- Stores workflow definitions in the database instead of in-memory only.
-- Enables persistence, versioning, and workspace-scoped workflows.

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0.0',
  enabled BOOLEAN NOT NULL DEFAULT true,

  -- Workflow config (JSON)
  nodes JSONB NOT NULL DEFAULT '[]',
  entry_nodes JSONB,
  config JSONB NOT NULL DEFAULT '{}',

  -- Tags for discovery and filtering
  tags JSONB NOT NULL DEFAULT '[]',

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_enabled ON workflow_definitions(enabled);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_name ON workflow_definitions(name);

-- Row Level Security
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to workflow_definitions"
  ON workflow_definitions FOR ALL
  USING (true)
  WITH CHECK (true);
