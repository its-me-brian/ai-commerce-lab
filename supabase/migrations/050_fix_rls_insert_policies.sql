-- Migration 050: Fix RLS INSERT policies on migration 048 tables
-- PROBLEM: security_audit_logs, execution_evaluations, agent_handoffs have
--   WITH CHECK (true) on INSERT — any authenticated user can insert into any workspace
-- FIX: Replace with workspace-scoped policies using is_workspace_member()
-- Idempotent: all DROPs use IF EXISTS

-- ============================================
-- 1. SECURITY_AUDIT_LOGS — restrict INSERT to workspace members
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can insert" ON security_audit_logs;

DO $$ BEGIN
  CREATE POLICY "Members can insert workspace security audit logs"
    ON security_audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (workspace_id IS NULL OR is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 2. EXECUTION_EVALUATIONS — restrict INSERT to workspace members
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can insert" ON execution_evaluations;

DO $$ BEGIN
  CREATE POLICY "Members can insert workspace evaluations"
    ON execution_evaluations FOR INSERT
    TO authenticated
    WITH CHECK (workspace_id IS NULL OR is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 3. AGENT_HANDOFFS — restrict INSERT to workspace members
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can insert" ON agent_handoffs;

DO $$ BEGIN
  CREATE POLICY "Members can insert workspace handoffs"
    ON agent_handoffs FOR INSERT
    TO authenticated
    WITH CHECK (workspace_id IS NULL OR is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 4. AGENT_HANDOFFS — restrict UPDATE to workspace members
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can update own workspace" ON agent_handoffs;

DO $$ BEGIN
  CREATE POLICY "Members can update workspace handoffs"
    ON agent_handoffs FOR UPDATE
    TO authenticated
    USING (workspace_id IS NULL OR is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- DONE
-- ============================================
-- After this migration:
-- 1. security_audit_logs INSERT requires workspace membership
-- 2. execution_evaluations INSERT requires workspace membership
-- 3. agent_handoffs INSERT/UPDATE requires workspace membership
-- 4. SELECT policies remain unchanged (already workspace-scoped)
