-- Migration 031: Conversation Type + Participants
-- FASE 1: Supports room (multi-agent) and direct (1:1) conversation types.
-- Backward compatible: existing conversations default to 'direct'.

-- 1. Add conversation_type column (direct | room)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS conversation_type TEXT DEFAULT 'direct';

-- 2. Make agent_id nullable (room conversations don't have a single agent)
--    Existing rows keep their agent_id — no data loss.
ALTER TABLE conversations
  ALTER COLUMN agent_id DROP NOT NULL;

-- 3. Conversation participants — tracks which agents are in a conversation
CREATE TABLE IF NOT EXISTS conversation_participants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'participant',    -- owner | participant | observer
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, agent_id)
);

-- 4. Indexes for new columns/tables
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(conversation_type);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_agent ON conversation_participants(agent_id);

-- 5. RLS for participants
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON conversation_participants FOR ALL USING (true);

-- 6. Migrate existing conversations: set conversation_type = 'direct' (already default)
--    Add existing agent_id as participant with role 'owner'
INSERT INTO conversation_participants (conversation_id, agent_id, role)
SELECT id, agent_id, 'owner'
FROM conversations
WHERE agent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.agent_id = conversations.agent_id
  );
