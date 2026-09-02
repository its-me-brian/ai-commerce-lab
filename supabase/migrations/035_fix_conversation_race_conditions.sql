-- Migration 035: Fix conversation race conditions
-- Phase 2: Room uniqueness, direct chat workspace scoping, message pagination

-- 1. Unique constraint: only ONE active room per workspace
--    Partial index: only active rooms (archived/deleted don't conflict)
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_active_room
  ON conversations (workspace_id)
  WHERE conversation_type = 'room' AND status = 'active';

-- 2. Unique constraint: only ONE active direct conversation per agent+workspace
--    Prevents duplicate direct chats when multiple tabs click the same agent
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_direct_agent_workspace
  ON conversations (agent_id, workspace_id)
  WHERE conversation_type = 'direct' AND status = 'active' AND workspace_id IS NOT NULL;

-- 3. Add pagination index for messages (already have conversation_id index, but add compound)
CREATE INDEX IF NOT EXISTS idx_conv_messages_conversation_created
  ON conversation_messages (conversation_id, created_at);
