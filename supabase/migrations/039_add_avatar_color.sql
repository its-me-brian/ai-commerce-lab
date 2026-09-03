-- Migration 039: Add avatar_color column to agents table
-- The avatar_color column is referenced in the codebase but was never created via migration.

ALTER TABLE agents ADD COLUMN IF NOT EXISTS avatar_color TEXT;

-- Add index for faster lookups by avatar_color (for UI color picker)
CREATE INDEX IF NOT EXISTS idx_agents_avatar_color ON agents(avatar_color) WHERE avatar_color IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN agents.avatar_color IS 'Hex color code for agent avatar (e.g., #3B82F6)';
