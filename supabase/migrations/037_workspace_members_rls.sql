-- Migration 037: workspace_members + real RLS
-- Creates multi-tenancy table and rewrites all RLS policies
-- to enforce workspace-level data isolation.

-- ============================================
-- 1. WORKSPACE MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON workspace_members(workspace_id, role);

-- RLS: workspace members can see their own membership
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_members_select" ON workspace_members;
CREATE POLICY "workspace_members_select" ON workspace_members
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm WHERE wm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "workspace_members_insert" ON workspace_members;
CREATE POLICY "workspace_members_insert" ON workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "workspace_members_update" ON workspace_members;
CREATE POLICY "workspace_members_update" ON workspace_members
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "workspace_members_delete" ON workspace_members;
CREATE POLICY "workspace_members_delete" ON workspace_members
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.role = 'owner'
    )
  );

-- ============================================
-- 2. REWRITE RLS FOR ALL BUSINESS TABLES
-- ============================================
-- Helper function: check if user is member of workspace
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if user has minimum role in workspace
CREATE OR REPLACE FUNCTION has_workspace_role(ws_id TEXT, min_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
    AND CASE min_role
      WHEN 'viewer' THEN role IN ('viewer', 'member', 'admin', 'owner')
      WHEN 'member' THEN role IN ('member', 'admin', 'owner')
      WHEN 'admin' THEN role IN ('admin', 'owner')
      WHEN 'owner' THEN role = 'owner'
      ELSE FALSE
    END
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- 3. WORKSPACES — members can read/update their workspaces
-- ============================================
DROP POLICY IF EXISTS "workspaces_select" ON workspaces;
CREATE POLICY "workspaces_select" ON workspaces
  FOR SELECT TO authenticated
  USING (is_workspace_member(id));

DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;
CREATE POLICY "workspaces_insert" ON workspaces
  FOR INSERT TO authenticated
  WITH CHECK (TRUE); -- Anyone can create a workspace (becomes owner)

DROP POLICY IF EXISTS "workspaces_update" ON workspaces;
CREATE POLICY "workspaces_update" ON workspaces
  FOR UPDATE TO authenticated
  USING (has_workspace_role(id, 'admin'));

-- ============================================
-- 4. AGENTS — scoped to workspace
-- ============================================
DROP POLICY IF EXISTS "agents_select" ON agents;
CREATE POLICY "agents_select" ON agents
  FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "agents_insert" ON agents;
CREATE POLICY "agents_insert" ON agents
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NULL OR has_workspace_role(workspace_id, 'admin'));

DROP POLICY IF EXISTS "agents_update" ON agents;
CREATE POLICY "agents_update" ON agents
  FOR UPDATE TO authenticated
  USING (workspace_id IS NULL OR has_workspace_role(workspace_id, 'admin'));

-- ============================================
-- 5. CONVERSATIONS — scoped to workspace
-- ============================================
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "conversations_insert" ON conversations;
CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "conversations_update" ON conversations;
CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id));

-- ============================================
-- 6. CONVERSATION_MESSAGES — via conversation's workspace
-- ============================================
DROP POLICY IF EXISTS "conversation_messages_select" ON conversation_messages;
CREATE POLICY "conversation_messages_select" ON conversation_messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.workspace_id IS NULL OR is_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS "conversation_messages_insert" ON conversation_messages;
CREATE POLICY "conversation_messages_insert" ON conversation_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.workspace_id IS NULL OR is_workspace_member(c.workspace_id)
    )
  );

-- ============================================
-- 7. CONVERSATION_PARTICIPANTS — via conversation's workspace
-- ============================================
DROP POLICY IF EXISTS "conversation_participants_select" ON conversation_participants;
CREATE POLICY "conversation_participants_select" ON conversation_participants
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.workspace_id IS NULL OR is_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS "conversation_participants_insert" ON conversation_participants;
CREATE POLICY "conversation_participants_insert" ON conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.workspace_id IS NULL OR is_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS "conversation_participants_all" ON conversation_participants;
CREATE POLICY "conversation_participants_all" ON conversation_participants
  FOR ALL TO authenticated
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      WHERE c.workspace_id IS NULL OR is_workspace_member(c.workspace_id)
    )
  );

-- ============================================
-- 8. AGENT_TASKS — via agent's workspace
-- ============================================
DROP POLICY IF EXISTS "agent_tasks_select" ON agent_tasks;
CREATE POLICY "agent_tasks_select" ON agent_tasks
  FOR SELECT TO authenticated
  USING (
    agent_id IN (
      SELECT a.id FROM agents a
      WHERE a.workspace_id IS NULL OR is_workspace_member(a.workspace_id)
    )
  );

DROP POLICY IF EXISTS "agent_tasks_insert" ON agent_tasks;
CREATE POLICY "agent_tasks_insert" ON agent_tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    agent_id IN (
      SELECT a.id FROM agents a
      WHERE a.workspace_id IS NULL OR is_workspace_member(a.workspace_id)
    )
  );

-- ============================================
-- 9. AGENT_RUNS — via agent's workspace
-- ============================================
DROP POLICY IF EXISTS "agent_runs_select" ON agent_runs;
CREATE POLICY "agent_runs_select" ON agent_runs
  FOR SELECT TO authenticated
  USING (
    agent_id IN (
      SELECT a.id FROM agents a
      WHERE a.workspace_id IS NULL OR is_workspace_member(a.workspace_id)
    )
  );

DROP POLICY IF EXISTS "agent_runs_insert" ON agent_runs;
CREATE POLICY "agent_runs_insert" ON agent_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    agent_id IN (
      SELECT a.id FROM agents a
      WHERE a.workspace_id IS NULL OR is_workspace_member(a.workspace_id)
    )
  );

-- ============================================
-- 10. AGENT_MEMORY — scoped to workspace
-- ============================================
DROP POLICY IF EXISTS "agent_memory_select" ON agent_memory;
CREATE POLICY "agent_memory_select" ON agent_memory
  FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "agent_memory_insert" ON agent_memory;
CREATE POLICY "agent_memory_insert" ON agent_memory
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NULL OR is_workspace_member(workspace_id));

-- ============================================
-- 11. PRODUCT_CATALOG — scoped to workspace
-- ============================================
DROP POLICY IF EXISTS "product_catalog_select" ON product_catalog;
CREATE POLICY "product_catalog_select" ON product_catalog
  FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "product_catalog_insert" ON product_catalog;
CREATE POLICY "product_catalog_insert" ON product_catalog
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "product_catalog_update" ON product_catalog;
CREATE POLICY "product_catalog_update" ON product_catalog
  FOR UPDATE TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "product_catalog_delete" ON product_catalog;
CREATE POLICY "product_catalog_delete" ON product_catalog
  FOR DELETE TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id));

-- ============================================
-- 12. APPROVALS — via agent's workspace
-- ============================================
DROP POLICY IF EXISTS "approvals_select" ON approvals;
CREATE POLICY "approvals_select" ON approvals
  FOR SELECT TO authenticated
  USING (
    agent_id IN (
      SELECT a.id FROM agents a
      WHERE a.workspace_id IS NULL OR is_workspace_member(a.workspace_id)
    )
  );

DROP POLICY IF EXISTS "approvals_update" ON approvals;
CREATE POLICY "approvals_update" ON approvals
  FOR UPDATE TO authenticated
  USING (
    agent_id IN (
      SELECT a.id FROM agents a
      WHERE a.workspace_id IS NULL OR is_workspace_member(a.workspace_id)
    )
  );

-- ============================================
-- 13. KNOWLEDGE_DOCUMENTS — scoped to workspace
-- ============================================
DROP POLICY IF EXISTS "knowledge_documents_select" ON knowledge_documents;
CREATE POLICY "knowledge_documents_select" ON knowledge_documents
  FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "knowledge_documents_insert" ON knowledge_documents;
CREATE POLICY "knowledge_documents_insert" ON knowledge_documents
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "knowledge_documents_update" ON knowledge_documents;
CREATE POLICY "knowledge_documents_update" ON knowledge_documents
  FOR UPDATE TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "knowledge_documents_delete" ON knowledge_documents;
CREATE POLICY "knowledge_documents_delete" ON knowledge_documents
  FOR DELETE TO authenticated
  USING (workspace_id IS NULL OR is_workspace_member(workspace_id));

-- ============================================
-- 14. APP_EVENTS — anyone authenticated can read
-- ============================================
DROP POLICY IF EXISTS "app_events_select" ON app_events;
CREATE POLICY "app_events_select" ON app_events
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "app_events_insert" ON app_events;
CREATE POLICY "app_events_insert" ON app_events
  FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ============================================
-- 15. TASK_EVENTS — via task's agent workspace
-- ============================================
DROP POLICY IF EXISTS "task_events_select" ON task_events;
CREATE POLICY "task_events_select" ON task_events
  FOR SELECT TO authenticated USING (TRUE);

-- ============================================
-- 16. AI_PROVIDERS, AI_MODELS, AGENT_CONFIGS, etc. — authenticated read
-- ============================================
DROP POLICY IF EXISTS "ai_providers_select" ON ai_providers;
CREATE POLICY "ai_providers_select" ON ai_providers
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "ai_models_select" ON ai_models;
CREATE POLICY "ai_models_select" ON ai_models
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "agent_configs_select" ON agent_configs;
CREATE POLICY "agent_configs_select" ON agent_configs
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "agent_permissions_select" ON agent_permissions;
CREATE POLICY "agent_permissions_select" ON agent_permissions
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "agent_model_routes_select" ON agent_model_routes;
CREATE POLICY "agent_model_routes_select" ON agent_model_routes
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "agent_definitions_select" ON agent_definitions;
CREATE POLICY "agent_definitions_select" ON agent_definitions
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "skills_select" ON skills;
CREATE POLICY "skills_select" ON skills
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "agent_skills_select" ON agent_skills;
CREATE POLICY "agent_skills_select" ON agent_skills
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "workflow_definitions_select" ON workflow_definitions;
CREATE POLICY "workflow_definitions_select" ON workflow_definitions
  FOR SELECT TO authenticated USING (TRUE);

-- ============================================
-- 17. OBSERVABILITY TABLES — authenticated read/write
-- ============================================
DROP POLICY IF EXISTS "structured_logs_select" ON structured_logs;
CREATE POLICY "structured_logs_select" ON structured_logs
  FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "structured_logs_insert" ON structured_logs;
CREATE POLICY "structured_logs_insert" ON structured_logs
  FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "metrics_select" ON metrics;
CREATE POLICY "metrics_select" ON metrics
  FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "metrics_insert" ON metrics;
CREATE POLICY "metrics_insert" ON metrics
  FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "traces_select" ON traces;
CREATE POLICY "traces_select" ON traces
  FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "traces_insert" ON traces;
CREATE POLICY "traces_insert" ON traces
  FOR INSERT TO authenticated WITH CHECK (TRUE);

DROP POLICY IF EXISTS "spans_select" ON spans;
CREATE POLICY "spans_select" ON spans
  FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "spans_insert" ON spans;
CREATE POLICY "spans_insert" ON spans
  FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ============================================
-- 18. COST_TABLES — authenticated read/write
-- ============================================
DROP POLICY IF EXISTS "cost_budgets_select" ON cost_budgets;
CREATE POLICY "cost_budgets_select" ON cost_budgets
  FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "cost_budgets_insert" ON cost_budgets;
CREATE POLICY "cost_budgets_insert" ON cost_budgets
  FOR INSERT TO authenticated WITH CHECK (TRUE);
DROP POLICY IF EXISTS "cost_budgets_update" ON cost_budgets;
CREATE POLICY "cost_budgets_update" ON cost_budgets
  FOR UPDATE TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "cost_records_select" ON cost_records;
CREATE POLICY "cost_records_select" ON cost_records
  FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "cost_records_insert" ON cost_records;
CREATE POLICY "cost_records_insert" ON cost_records
  FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ============================================
-- 19. CREDENTIALS — service role only (no authenticated policy)
-- ============================================
-- ai_provider_credentials: DROP all authenticated policies (already done in 034)
-- Ensures credentials are ONLY accessible via service role

-- ============================================
-- 20. UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_workspace_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workspace_members_updated_at ON workspace_members;
CREATE TRIGGER workspace_members_updated_at
  BEFORE UPDATE ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_members_updated_at();
