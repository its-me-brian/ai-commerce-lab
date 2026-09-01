-- Migration 032: Atomic message count + timestamp update
-- Fixes race condition in ConversationEngine.addMessage() where
-- read-modify-write could lose increments under concurrent writes.

CREATE OR REPLACE FUNCTION increment_message_count(conv_id TEXT)
RETURNS VOID AS $$
  UPDATE conversations
  SET message_count = message_count + 1,
      last_message_at = now(),
      updated_at = now()
  WHERE id = conv_id;
$$ LANGUAGE sql;
