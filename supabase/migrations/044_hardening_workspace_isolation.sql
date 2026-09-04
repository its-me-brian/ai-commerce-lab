-- Migration 044: Hardening Workspace Isolation
-- Fixes P0/P1 security gaps discovered during production hardening audit:
-- 1. agent_memory.workspace_id → NOT NULL (was optional, allowed cross-workspace leaks)
-- 2. conversation_messages gets direct workspace_id column (was enforced only via JOIN)
-- 3. Missing indexes for performance

-- ============================================
-- 1. AGENT_MEMORY: enforce workspace_id NOT NULL
-- ============================================
-- Backfill any orphaned NULL rows first
UPDATE agent_memory SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;

ALTER TABLE agent_memory
  ALTER COLUMN workspace_id SET NOT NULL;

-- ============================================
-- 2. CONVERSATION_MESSAGES: add direct workspace_id
-- ============================================
-- Currently enforced only via JOIN to conversations. Adding direct column
-- enables faster queries and consistent pattern with all other tables.

ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS workspace_id TEXT;

-- Backfill from parent conversation
UPDATE conversation_messages cm
SET workspace_id = c.workspace_id
FROM conversations c
WHERE cm.conversation_id = c.id
  AND cm.workspace_id IS NULL;

-- Any remaining NULLs get ws-default
UPDATE conversation_messages SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;

ALTER TABLE conversation_messages
  ALTER COLUMN workspace_id SET NOT NULL;

-- FK constraint
DO $$ BEGIN
  ALTER TABLE conversation_messages ADD CONSTRAINT fk_conv_messages_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_conv_messages_workspace ON conversation_messages(workspace_id);

-- ============================================
-- 3. CONVERSATION_PARTICIPANTS: add workspace_id
-- ============================================
ALTER TABLE conversation_participants
  ADD COLUMN IF NOT EXISTS workspace_id TEXT;

-- Backfill from parent conversation
UPDATE conversation_participants cp
SET workspace_id = c.workspace_id
FROM conversations c
WHERE cp.conversation_id = c.id
  AND cp.workspace_id IS NULL;

UPDATE conversation_participants SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;

ALTER TABLE conversation_participants
  ALTER COLUMN workspace_id SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE conversation_participants ADD CONSTRAINT fk_conv_participants_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_conv_participants_workspace ON conversation_participants(workspace_id);

-- ============================================
-- 4. Strengthen conversation_messages RLS
-- ============================================
-- Drop the old JOIN-based policy (replaced by direct workspace_id check)
DROP POLICY IF EXISTS "Members can read conversation messages" ON conversation_messages;
DROP POLICY IF EXISTS "Members can create conversation messages" ON conversation_messages;

-- New policies using direct workspace_id
CREATE POLICY "Members can read workspace conversation messages"
  ON conversation_messages FOR SELECT
  TO authenticated
  USING (is_workspace_member(conversation_messages.workspace_id));

CREATE POLICY "Members can create workspace conversation messages"
  ON conversation_messages FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(conversation_messages.workspace_id));

-- ============================================
-- 5. Strengthen conversation_participants RLS
-- ============================================
DROP POLICY IF EXISTS "Members can read conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Members can manage conversation participants" ON conversation_participants;

CREATE POLICY "Members can read workspace conversation participants"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (is_workspace_member(conversation_participants.workspace_id));

CREATE POLICY "Members can manage workspace conversation participants"
  ON conversation_participants FOR ALL
  TO authenticated
  USING (is_workspace_member(conversation_participants.workspace_id));

-- ============================================
-- DONE
-- ============================================
-- After this migration:
-- 1. agent_memory.workspace_id is NOT NULL — all memories are workspace-scoped
-- 2. conversation_messages has direct workspace_id — faster queries, consistent pattern
-- 3. conversation_participants has direct workspace_id — same
-- 4. RLS policies use direct workspace_id check (no JOIN needed)
-- 5. All conversations already had workspace_id from migration 019
