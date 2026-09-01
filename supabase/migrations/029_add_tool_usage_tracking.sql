-- Migration 029: Tool usage tracking in agent_runs
-- Adds tools_used column to track which tools each agent invocation called.

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS tools_used JSONB NOT NULL DEFAULT '[]';

-- Index for querying by tool usage
CREATE INDEX IF NOT EXISTS idx_agent_runs_tools_used ON agent_runs USING GIN (tools_used);
