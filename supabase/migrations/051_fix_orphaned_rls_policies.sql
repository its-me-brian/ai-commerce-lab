-- Migration 051: Fix orphaned RLS policies
-- CRITICAL SECURITY FIX: Drop orphaned policy from migration 030 that allows
-- cross-workspace access to knowledge_documents
-- Idempotent: all DROPs use IF EXISTS

-- ============================================
-- 1. KNOWLEDGE_DOCUMENTS — drop orphaned permissive policy
-- ============================================
-- Migration 030 created "Allow all access to knowledge_documents" with USING (true)
-- Migration 041 created proper workspace-scoped policies BUT never dropped 030's policy
-- In PostgreSQL, permissive policies are OR'd — the USING (true) policy bypasses all scoping
DROP POLICY IF EXISTS "Allow all access to knowledge_documents" ON knowledge_documents;

-- ============================================
-- 2. Verify remaining policies are workspace-scoped
-- ============================================
-- After this migration, knowledge_documents should only have:
-- - "Members can read workspace knowledge docs" (from 041)
-- - "Members can manage workspace knowledge docs" (from 041)
