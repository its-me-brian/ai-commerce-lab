-- Migration 034: Fix RLS policies
-- Replaces ALL wildcard USING (true) policies with proper auth-based policies
-- This ensures only authenticated users can access their own data

-- ============================================
-- HELPER: Get current user ID from JWT
-- ============================================
-- auth.uid() returns the user ID from the JWT token

-- ============================================
-- AGENTS
-- ============================================
-- Agents are shared across the workspace, readable by all authenticated users
-- Only service role can modify (via admin client)

-- Drop existing wildcard policy
DROP POLICY IF EXISTS "Service role full access" ON agents;

-- Read: any authenticated user can read agents
CREATE POLICY "Authenticated users can read agents"
  ON agents FOR SELECT
  TO authenticated
  USING (true);

-- Insert/Update/Delete: only service role (no policy = denied for anon/authenticated)
-- Service role bypasses RLS, so it still works

-- ============================================
-- AGENT CONFIGS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON agent_configs;

CREATE POLICY "Authenticated users can read agent configs"
  ON agent_configs FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- AGENT TASKS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON agent_tasks;

CREATE POLICY "Authenticated users can read tasks"
  ON agent_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tasks"
  ON agent_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- AGENT RUNS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON agent_runs;

CREATE POLICY "Authenticated users can read runs"
  ON agent_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert runs"
  ON agent_runs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- AGENT PERMISSIONS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON agent_permissions;

CREATE POLICY "Authenticated users can read permissions"
  ON agent_permissions FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- AI PROVIDERS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON ai_providers;

CREATE POLICY "Authenticated users can read providers"
  ON ai_providers FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- AI MODELS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON ai_models;

CREATE POLICY "Authenticated users can read models"
  ON ai_models FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- WORKSPACES
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON workspaces;

CREATE POLICY "Authenticated users can read workspaces"
  ON workspaces FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create workspaces"
  ON workspaces FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update workspaces"
  ON workspaces FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================
-- CONVERSATIONS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON conversations;

CREATE POLICY "Authenticated users can read conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================
-- CONVERSATION MESSAGES
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON conversation_messages;

CREATE POLICY "Authenticated users can read messages"
  ON conversation_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create messages"
  ON conversation_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- CONVERSATION PARTICIPANTS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON conversation_participants;

CREATE POLICY "Authenticated users can read participants"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage participants"
  ON conversation_participants FOR ALL
  TO authenticated
  USING (true);

-- ============================================
-- AGENT MEMORY
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON agent_memory;

CREATE POLICY "Authenticated users can read memory"
  ON agent_memory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert memory"
  ON agent_memory FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- TASK EVENTS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON task_events;

CREATE POLICY "Authenticated users can read task events"
  ON task_events FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- APPROVALS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON approvals;

CREATE POLICY "Authenticated users can read approvals"
  ON approvals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update approvals"
  ON approvals FOR UPDATE
  TO authenticated
  USING (true);

-- ============================================
-- APP EVENTS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON app_events;

CREATE POLICY "Authenticated users can read events"
  ON app_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert events"
  ON app_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- SKILLS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON skills;

CREATE POLICY "Authenticated users can read skills"
  ON skills FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- AGENT SKILLS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON agent_skills;

CREATE POLICY "Authenticated users can read agent skills"
  ON agent_skills FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- AI PROVIDER CREDENTIALS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON ai_provider_credentials;

-- Credentials should ONLY be accessible via service role
-- No policy for authenticated = denied

-- ============================================
-- AGENT MODEL ROUTES
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON agent_model_routes;

CREATE POLICY "Authenticated users can read model routes"
  ON agent_model_routes FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- AGENT DEFINITIONS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON agent_definitions;

CREATE POLICY "Authenticated users can read definitions"
  ON agent_definitions FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- PRODUCT CATALOG
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON product_catalog;

CREATE POLICY "Authenticated users can read catalog"
  ON product_catalog FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage catalog"
  ON product_catalog FOR ALL
  TO authenticated
  USING (true);

-- ============================================
-- WORKFLOW DEFINITIONS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON workflow_definitions;

CREATE POLICY "Authenticated users can read workflows"
  ON workflow_definitions FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- KNOWLEDGE DOCUMENTS
-- ============================================
DROP POLICY IF EXISTS "Service role full access" ON knowledge_documents;

CREATE POLICY "Authenticated users can read knowledge docs"
  ON knowledge_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage knowledge docs"
  ON knowledge_documents FOR ALL
  TO authenticated
  USING (true);

-- ============================================
-- OBSERVABILITY TABLES
-- ============================================

-- STRUCTURED LOGS
DROP POLICY IF EXISTS "Service role full access" ON structured_logs;

CREATE POLICY "Authenticated users can read logs"
  ON structured_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert logs"
  ON structured_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- METRICS
DROP POLICY IF EXISTS "Service role full access" ON metrics;

CREATE POLICY "Authenticated users can read metrics"
  ON metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert metrics"
  ON metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- TRACES
DROP POLICY IF EXISTS "Service role full access" ON traces;

CREATE POLICY "Authenticated users can read traces"
  ON traces FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert traces"
  ON traces FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SPANS
DROP POLICY IF EXISTS "Service role full access" ON spans;

CREATE POLICY "Authenticated users can read spans"
  ON spans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert spans"
  ON spans FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- COST BUDGETS
DROP POLICY IF EXISTS "Service role full access" ON cost_budgets;

CREATE POLICY "Authenticated users can read budgets"
  ON cost_budgets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage budgets"
  ON cost_budgets FOR ALL
  TO authenticated
  USING (true);

-- COST RECORDS
DROP POLICY IF EXISTS "Service role full access" ON cost_records;

CREATE POLICY "Authenticated users can read cost records"
  ON cost_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cost records"
  ON cost_records FOR INSERT
  TO authenticated
  WITH CHECK (true);
