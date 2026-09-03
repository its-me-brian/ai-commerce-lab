-- Migration 042: Backfill workspace_id for seed data
-- The seed agents and configs were inserted before workspace_id existed.
-- Migration 041 added RLS policies requiring is_workspace_member(workspace_id),
-- which blocks NULL workspace_id rows. This migration backfills them.
-- NOTE: ai_providers is a global table (no workspace_id column).

-- 1. Agents — assign all NULL workspace_id to ws-default
UPDATE agents SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;

-- 2. Agent configs — assign all NULL workspace_id to ws-default
UPDATE agent_configs SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;

-- 3. Agent model routes — assign all NULL workspace_id to ws-default
UPDATE agent_model_routes SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;

-- 4. Agent permissions — assign all NULL workspace_id to ws-default
UPDATE agent_permissions SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;
