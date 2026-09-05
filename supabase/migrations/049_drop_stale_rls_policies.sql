-- Migration 049: Drop stale RLS policies + enforce workspace_id NOT NULL
-- CRITICAL SECURITY FIXES:
-- 1. Drop stale policies from migration 037 that allow cross-workspace access
-- 2. Enforce workspace_id NOT NULL on all workspace-scoped tables
-- Idempotent: all DROPs use IF EXISTS, backfills use UPDATE WHERE IS NULL

-- ============================================
-- 1. BUSINESS TABLES (workspace_id IS NULL OR fallback)
-- ============================================

-- agents
DROP POLICY IF EXISTS "agents_select" ON agents;
DROP POLICY IF EXISTS "agents_insert" ON agents;
DROP POLICY IF EXISTS "agents_update" ON agents;

-- conversations
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
DROP POLICY IF EXISTS "conversations_update" ON conversations;

-- conversation_messages
DROP POLICY IF EXISTS "conversation_messages_select" ON conversation_messages;
DROP POLICY IF EXISTS "conversation_messages_insert" ON conversation_messages;

-- conversation_participants
DROP POLICY IF EXISTS "conversation_participants_select" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_insert" ON conversation_participants;
DROP POLICY IF EXISTS "conversation_participants_all" ON conversation_participants;

-- agent_tasks
DROP POLICY IF EXISTS "agent_tasks_select" ON agent_tasks;
DROP POLICY IF EXISTS "agent_tasks_insert" ON agent_tasks;

-- agent_runs
DROP POLICY IF EXISTS "agent_runs_select" ON agent_runs;
DROP POLICY IF EXISTS "agent_runs_insert" ON agent_runs;

-- agent_memory
DROP POLICY IF EXISTS "agent_memory_select" ON agent_memory;
DROP POLICY IF EXISTS "agent_memory_insert" ON agent_memory;

-- product_catalog
DROP POLICY IF EXISTS "product_catalog_select" ON product_catalog;
DROP POLICY IF EXISTS "product_catalog_insert" ON product_catalog;
DROP POLICY IF EXISTS "product_catalog_update" ON product_catalog;
DROP POLICY IF EXISTS "product_catalog_delete" ON product_catalog;

-- approvals
DROP POLICY IF EXISTS "approvals_select" ON approvals;
DROP POLICY IF EXISTS "approvals_update" ON approvals;

-- knowledge_documents
DROP POLICY IF EXISTS "knowledge_documents_select" ON knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_insert" ON knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_update" ON knowledge_documents;
DROP POLICY IF EXISTS "knowledge_documents_delete" ON knowledge_documents;

-- ============================================
-- 2. OBSERVABILITY TABLES (USING TRUE — global read/write)
-- ============================================

-- app_events
DROP POLICY IF EXISTS "app_events_select" ON app_events;
DROP POLICY IF EXISTS "app_events_insert" ON app_events;

-- task_events
DROP POLICY IF EXISTS "task_events_select" ON task_events;

-- structured_logs
DROP POLICY IF EXISTS "structured_logs_select" ON structured_logs;
DROP POLICY IF EXISTS "structured_logs_insert" ON structured_logs;

-- metrics
DROP POLICY IF EXISTS "metrics_select" ON metrics;
DROP POLICY IF EXISTS "metrics_insert" ON metrics;

-- traces
DROP POLICY IF EXISTS "traces_select" ON traces;
DROP POLICY IF EXISTS "traces_insert" ON traces;

-- spans
DROP POLICY IF EXISTS "spans_select" ON spans;
DROP POLICY IF EXISTS "spans_insert" ON spans;

-- ============================================
-- 3. COST TABLES (USING TRUE — global read/write)
-- ============================================

-- cost_budgets
DROP POLICY IF EXISTS "cost_budgets_select" ON cost_budgets;
DROP POLICY IF EXISTS "cost_budgets_insert" ON cost_budgets;
DROP POLICY IF EXISTS "cost_budgets_update" ON cost_budgets;

-- cost_records
DROP POLICY IF EXISTS "cost_records_select" ON cost_records;
DROP POLICY IF EXISTS "cost_records_insert" ON cost_records;

-- ============================================
-- 4. GLOBAL CONFIG TABLES (USING TRUE — intentional global read)
-- ============================================
-- NOTE: These are intentionally global (ai_providers, ai_models, etc.)
-- and are kept as-is. The 037 policies here are correct behavior.
-- No action needed for: ai_providers, ai_models, agent_configs,
-- agent_permissions, agent_model_routes, agent_definitions, skills,
-- agent_skills, workflow_definitions.

-- ============================================
-- 5. WORKSPACE_MEMBERS (keep 037 policies — they are correct)
-- ============================================
-- The workspace_members policies from 037 are correct and not replaced by 041.
-- No action needed.

-- ============================================
-- 6. ENFORCE workspace_id NOT NULL
-- ============================================
-- Tables that already have NOT NULL (no action needed):
--   agent_configs, agent_model_routes, agent_tasks, agent_runs, agent_permissions,
--   approvals, task_events (041), agent_memory (044), conversation_messages (044),
--   conversation_participants (044), knowledge_documents (030), workspace_members (037)

-- Backfill NULL workspace_id → 'ws-default' (safe, idempotent)
UPDATE agents SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;
UPDATE conversations SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;
UPDATE product_catalog SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;
UPDATE spans SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;
UPDATE app_events SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;
UPDATE structured_logs SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;
UPDATE metrics SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;
UPDATE traces SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;
UPDATE cost_budgets SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;
UPDATE cost_records SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;
UPDATE ai_provider_credentials SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;

-- Tables from migration 048 (new, may have NULLs)
UPDATE security_audit_logs SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;
UPDATE execution_evaluations SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;
UPDATE agent_handoffs SET workspace_id = 'ws-default' WHERE workspace_id IS NULL;

-- Set NOT NULL constraints
ALTER TABLE agents ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE conversations ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE product_catalog ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE spans ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE app_events ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE structured_logs ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE metrics ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE traces ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE cost_budgets ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE cost_records ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE ai_provider_credentials ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE security_audit_logs ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE execution_evaluations ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE agent_handoffs ALTER COLUMN workspace_id SET NOT NULL;

-- Fix FK constraints: change ON DELETE SET NULL → ON DELETE CASCADE for tables
-- that now have NOT NULL workspace_id (can't have NULL after delete)
DO $$ BEGIN
  ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_workspace_id_fkey;
  ALTER TABLE agents ADD CONSTRAINT agents_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_workspace_id_fkey;
  ALTER TABLE conversations ADD CONSTRAINT conversations_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE product_catalog DROP CONSTRAINT IF EXISTS product_catalog_workspace_id_fkey;
  ALTER TABLE product_catalog ADD CONSTRAINT product_catalog_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
