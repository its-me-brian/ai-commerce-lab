-- Migration 021: Agent Memory
-- FASE 19: Persistent memory for agents across conversations.
-- Agents can store and retrieve facts, preferences, and learned patterns.

CREATE TABLE IF NOT EXISTS agent_memory (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  memory_type TEXT NOT NULL,          -- fact | preference | pattern | decision | context
  content TEXT NOT NULL,              -- The memory content
  source TEXT,                        -- Where this memory came from (conversation, task, etc.)
  confidence REAL DEFAULT 1.0,        -- How confident we are in this memory (0-1)
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,            -- Optional expiration
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_workspace ON agent_memory(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(memory_type);

-- RLS
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON agent_memory FOR ALL USING (true);
