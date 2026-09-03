-- Migration 041: Phase 1 — Real Tenancy
-- Adds workspace_id to ALL workspace-scoped tables.
-- Replaces ALL USING (true) RLS policies with proper workspace membership policies.
-- This is the CRITICAL security fix that closes BLOCKER-1 and BLOCKER-2.

-- ============================================
-- HELPER FUNCTION: workspace membership check
-- ============================================
-- Used by ALL RLS policies to verify the user belongs to the workspace.
-- Returns TRUE if the authenticated user has a membership in the given workspace.

-- Drop old signatures from migration 037 (parameter was named "ws_id")
-- CASCADE drops all dependent RLS policies — they are recreated in section 6 below
DROP FUNCTION IF EXISTS public.is_workspace_member(text) CASCADE;
DROP FUNCTION IF EXISTS public.has_workspace_role(text, text) CASCADE;

CREATE OR REPLACE FUNCTION public.is_workspace_member(workspace_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Service role bypasses RLS, so this only runs for authenticated users
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = $1
      AND workspace_members.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper: check if user has a specific role or higher in workspace
CREATE OR REPLACE FUNCTION public.has_workspace_role(workspace_id TEXT, min_role TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  role_hierarchy JSONB := '{"viewer": 0, "member": 1, "admin": 2, "owner": 3}'::jsonb;
  user_role TEXT;
  user_level INTEGER;
  required_level INTEGER;
BEGIN
  SELECT wm.role INTO user_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = $1 AND wm.user_id = auth.uid();

  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  user_level := (role_hierarchy ->> user_role)::INTEGER;
  required_level := (role_hierarchy ->> $2)::INTEGER;

  RETURN user_level >= required_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- 1. ADD workspace_id TO TABLES
-- ============================================

-- agent_configs (linked to agents)
ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS workspace_id TEXT;
UPDATE agent_configs ac
SET workspace_id = a.workspace_id
FROM agents a
WHERE ac.agent_id = a.id AND ac.workspace_id IS NULL;

-- agent_model_routes (linked to agents)
ALTER TABLE agent_model_routes ADD COLUMN IF NOT EXISTS workspace_id TEXT;
UPDATE agent_model_routes amr
SET workspace_id = a.workspace_id
FROM agents a
WHERE amr.agent_id = a.id AND amr.workspace_id IS NULL;

-- agent_tasks (linked to agents)
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS workspace_id TEXT;
UPDATE agent_tasks at
SET workspace_id = a.workspace_id
FROM agents a
WHERE at.agent_id = a.id AND at.workspace_id IS NULL;

-- agent_runs (linked to agent_tasks → agents)
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS workspace_id TEXT;
UPDATE agent_runs ar
SET workspace_id = at.workspace_id
FROM agent_tasks at
WHERE ar.task_id = at.id AND ar.workspace_id IS NULL;

-- agent_permissions (linked to agents)
ALTER TABLE agent_permissions ADD COLUMN IF NOT EXISTS workspace_id TEXT;
UPDATE agent_permissions ap
SET workspace_id = a.workspace_id
FROM agents a
WHERE ap.agent_id = a.id AND ap.workspace_id IS NULL;

-- ai_provider_credentials (no direct link — assign to ws-default)
ALTER TABLE ai_provider_credentials ADD COLUMN IF NOT EXISTS workspace_id TEXT DEFAULT 'ws-default';

-- approvals (linked to agents)
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS workspace_id TEXT;
UPDATE approvals ap
SET workspace_id = a.workspace_id
FROM agents a
WHERE ap.agent_id = a.id AND ap.workspace_id IS NULL;

-- task_events (linked to agent_tasks → agents)
ALTER TABLE task_events ADD COLUMN IF NOT EXISTS workspace_id TEXT;
UPDATE task_events te
SET workspace_id = at.workspace_id
FROM agent_tasks at
WHERE te.task_id = at.id AND te.workspace_id IS NULL;

-- app_events (no direct link — assign to ws-default)
ALTER TABLE app_events ADD COLUMN IF NOT EXISTS workspace_id TEXT DEFAULT 'ws-default';

-- structured_logs (no direct link — assign to ws-default)
ALTER TABLE structured_logs ADD COLUMN IF NOT EXISTS workspace_id TEXT DEFAULT 'ws-default';

-- metrics (no direct link — assign to ws-default)
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS workspace_id TEXT DEFAULT 'ws-default';

-- traces (no direct link — assign to ws-default)
ALTER TABLE traces ADD COLUMN IF NOT EXISTS workspace_id TEXT DEFAULT 'ws-default';

-- spans (linked to traces)
ALTER TABLE spans ADD COLUMN IF NOT EXISTS workspace_id TEXT;
UPDATE spans s
SET workspace_id = t.workspace_id
FROM traces t
WHERE s.trace_id = t.id AND s.workspace_id IS NULL;

-- cost_budgets (entity-based — assign to ws-default)
ALTER TABLE cost_budgets ADD COLUMN IF NOT EXISTS workspace_id TEXT DEFAULT 'ws-default';

-- cost_records (entity-based — assign to ws-default)
ALTER TABLE cost_records ADD COLUMN IF NOT EXISTS workspace_id TEXT DEFAULT 'ws-default';

-- ============================================
-- 2. SET NOT NULL WHERE SAFE
-- ============================================
-- After backfill, set NOT NULL on columns that should always have a value.

ALTER TABLE agent_configs ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE agent_model_routes ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE agent_tasks ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE agent_runs ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE agent_permissions ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE approvals ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE task_events ALTER COLUMN workspace_id SET NOT NULL;

-- ============================================
-- 3. ADD FOREIGN KEYS
-- ============================================

DO $$ BEGIN
  ALTER TABLE agent_configs ADD CONSTRAINT fk_agent_configs_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE agent_model_routes ADD CONSTRAINT fk_agent_model_routes_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE agent_tasks ADD CONSTRAINT fk_agent_tasks_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE agent_runs ADD CONSTRAINT fk_agent_runs_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE agent_permissions ADD CONSTRAINT fk_agent_permissions_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ai_provider_credentials ADD CONSTRAINT fk_credentials_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE approvals ADD CONSTRAINT fk_approvals_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE task_events ADD CONSTRAINT fk_task_events_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE app_events ADD CONSTRAINT fk_app_events_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE structured_logs ADD CONSTRAINT fk_structured_logs_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE metrics ADD CONSTRAINT fk_metrics_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE traces ADD CONSTRAINT fk_traces_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE spans ADD CONSTRAINT fk_spans_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE cost_budgets ADD CONSTRAINT fk_cost_budgets_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE cost_records ADD CONSTRAINT fk_cost_records_workspace
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 4. ADD INDEXES ON workspace_id
-- ============================================

CREATE INDEX IF NOT EXISTS idx_agent_configs_workspace ON agent_configs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_model_routes_workspace ON agent_model_routes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_workspace ON agent_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace ON agent_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_permissions_workspace ON agent_permissions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_credentials_workspace ON ai_provider_credentials(workspace_id);
CREATE INDEX IF NOT EXISTS idx_approvals_workspace ON approvals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_task_events_workspace ON task_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_app_events_workspace ON app_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_structured_logs_workspace ON structured_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_metrics_workspace ON metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_traces_workspace ON traces(workspace_id);
CREATE INDEX IF NOT EXISTS idx_spans_workspace ON spans(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cost_budgets_workspace ON cost_budgets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_cost_records_workspace ON cost_records(workspace_id);

-- ============================================
-- 5. DROP ALL OLD RLS POLICIES
-- ============================================
-- Remove the insecure USING (true) policies

-- Workspaces
DROP POLICY IF EXISTS "Authenticated users can read workspaces" ON workspaces;
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Authenticated users can update workspaces" ON workspaces;

-- Agents
DROP POLICY IF EXISTS "Authenticated users can read agents" ON agents;

-- Agent configs
DROP POLICY IF EXISTS "Authenticated users can read agent configs" ON agent_configs;

-- Agent tasks
DROP POLICY IF EXISTS "Authenticated users can read tasks" ON agent_tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON agent_tasks;

-- Agent runs
DROP POLICY IF EXISTS "Authenticated users can read runs" ON agent_runs;
DROP POLICY IF EXISTS "Authenticated users can insert runs" ON agent_runs;

-- Agent permissions
DROP POLICY IF EXISTS "Authenticated users can read permissions" ON agent_permissions;

-- AI providers (global — any authenticated user can read)
DROP POLICY IF EXISTS "Authenticated users can read providers" ON ai_providers;

-- AI models (global — any authenticated user can read)
DROP POLICY IF EXISTS "Authenticated users can read models" ON ai_models;

-- Conversations
DROP POLICY IF EXISTS "Authenticated users can read conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can update conversations" ON conversations;

-- Conversation messages
DROP POLICY IF EXISTS "Authenticated users can read messages" ON conversation_messages;
DROP POLICY IF EXISTS "Authenticated users can create messages" ON conversation_messages;

-- Conversation participants
DROP POLICY IF EXISTS "Authenticated users can read participants" ON conversation_participants;
DROP POLICY IF EXISTS "Authenticated users can manage participants" ON conversation_participants;

-- Agent memory
DROP POLICY IF EXISTS "Authenticated users can read memory" ON agent_memory;
DROP POLICY IF EXISTS "Authenticated users can insert memory" ON agent_memory;

-- Task events
DROP POLICY IF EXISTS "Authenticated users can read task events" ON task_events;

-- Approvals
DROP POLICY IF EXISTS "Authenticated users can read approvals" ON approvals;
DROP POLICY IF EXISTS "Authenticated users can update approvals" ON approvals;

-- App events
DROP POLICY IF EXISTS "Authenticated users can read events" ON app_events;
DROP POLICY IF EXISTS "Authenticated users can insert events" ON app_events;

-- Skills (global)
DROP POLICY IF EXISTS "Authenticated users can read skills" ON skills;

-- Agent skills (global)
DROP POLICY IF EXISTS "Authenticated users can read agent skills" ON agent_skills;

-- Agent model routes
DROP POLICY IF EXISTS "Authenticated users can read model routes" ON agent_model_routes;

-- Agent definitions (global)
DROP POLICY IF EXISTS "Authenticated users can read definitions" ON agent_definitions;

-- Product catalog
DROP POLICY IF EXISTS "Authenticated users can read catalog" ON product_catalog;
DROP POLICY IF EXISTS "Authenticated users can manage catalog" ON product_catalog;

-- Workflow definitions (global)
DROP POLICY IF EXISTS "Authenticated users can read workflows" ON workflow_definitions;

-- Knowledge documents
DROP POLICY IF EXISTS "Authenticated users can read knowledge docs" ON knowledge_documents;
DROP POLICY IF EXISTS "Authenticated users can manage knowledge docs" ON knowledge_documents;

-- Structured logs
DROP POLICY IF EXISTS "Authenticated users can read logs" ON structured_logs;
DROP POLICY IF EXISTS "Authenticated users can insert logs" ON structured_logs;

-- Metrics
DROP POLICY IF EXISTS "Authenticated users can read metrics" ON metrics;
DROP POLICY IF EXISTS "Authenticated users can insert metrics" ON metrics;

-- Traces
DROP POLICY IF EXISTS "Authenticated users can read traces" ON traces;
DROP POLICY IF EXISTS "Authenticated users can insert traces" ON traces;

-- Spans
DROP POLICY IF EXISTS "Authenticated users can read spans" ON spans;
DROP POLICY IF EXISTS "Authenticated users can insert spans" ON spans;

-- Cost budgets
DROP POLICY IF EXISTS "Authenticated users can read budgets" ON cost_budgets;
DROP POLICY IF EXISTS "Authenticated users can manage budgets" ON cost_budgets;

-- Cost records
DROP POLICY IF EXISTS "Authenticated users can read cost records" ON cost_records;
DROP POLICY IF EXISTS "Authenticated users can insert cost records" ON cost_records;

-- ============================================
-- 6. CREATE NEW RLS POLICIES
-- ============================================
-- Pattern: workspace membership → row.workspace_id match
-- Global tables: any authenticated user can read (no workspace filter)

-- ----------------------------------------
-- WORKSPACES
-- ----------------------------------------
CREATE POLICY "Members can read their workspaces"
  ON workspaces FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspaces.id));

CREATE POLICY "Authenticated users can create workspaces"
  ON workspaces FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only owner/admin can update workspace settings
CREATE POLICY "Admins can update workspace"
  ON workspaces FOR UPDATE
  TO authenticated
  USING (has_workspace_role(workspaces.id, 'admin'));

-- ----------------------------------------
-- AGENTS (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace agents"
  ON agents FOR SELECT
  TO authenticated
  USING (agents.workspace_id IS NOT NULL AND is_workspace_member(agents.workspace_id));

-- Service role handles inserts/updates/deletes

-- ----------------------------------------
-- AGENT CONFIGS (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace agent configs"
  ON agent_configs FOR SELECT
  TO authenticated
  USING (is_workspace_member(agent_configs.workspace_id));

CREATE POLICY "Admins can manage workspace agent configs"
  ON agent_configs FOR ALL
  TO authenticated
  USING (has_workspace_role(agent_configs.workspace_id, 'admin'));

-- ----------------------------------------
-- AGENT MODEL ROUTES (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace model routes"
  ON agent_model_routes FOR SELECT
  TO authenticated
  USING (is_workspace_member(agent_model_routes.workspace_id));

CREATE POLICY "Admins can manage workspace model routes"
  ON agent_model_routes FOR ALL
  TO authenticated
  USING (has_workspace_role(agent_model_routes.workspace_id, 'admin'));

-- ----------------------------------------
-- AGENT TASKS (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace tasks"
  ON agent_tasks FOR SELECT
  TO authenticated
  USING (is_workspace_member(agent_tasks.workspace_id));

CREATE POLICY "Members can insert workspace tasks"
  ON agent_tasks FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(agent_tasks.workspace_id));

-- ----------------------------------------
-- AGENT RUNS (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace runs"
  ON agent_runs FOR SELECT
  TO authenticated
  USING (is_workspace_member(agent_runs.workspace_id));

CREATE POLICY "Members can insert workspace runs"
  ON agent_runs FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(agent_runs.workspace_id));

-- ----------------------------------------
-- AGENT PERMISSIONS (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace agent permissions"
  ON agent_permissions FOR SELECT
  TO authenticated
  USING (is_workspace_member(agent_permissions.workspace_id));

-- ----------------------------------------
-- AI PROVIDERS (GLOBAL — any authenticated user can read)
-- ----------------------------------------
CREATE POLICY "Authenticated users can read providers"
  ON ai_providers FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------
-- AI MODELS (GLOBAL — any authenticated user can read)
-- ----------------------------------------
CREATE POLICY "Authenticated users can read models"
  ON ai_models FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------
-- AI PROVIDER CREDENTIALS (workspace-scoped, restricted)
-- ----------------------------------------
-- No SELECT policy for authenticated — only service role can read
-- This ensures credentials NEVER reach the browser

-- ----------------------------------------
-- CONVERSATIONS (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (is_workspace_member(conversations.workspace_id));

CREATE POLICY "Members can create workspace conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(conversations.workspace_id));

CREATE POLICY "Members can update workspace conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (is_workspace_member(conversations.workspace_id));

-- ----------------------------------------
-- CONVERSATION MESSAGES (workspace-scoped via conversation)
-- ----------------------------------------
CREATE POLICY "Members can read conversation messages"
  ON conversation_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_messages.conversation_id
        AND is_workspace_member(c.workspace_id)
    )
  );

CREATE POLICY "Members can create conversation messages"
  ON conversation_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_messages.conversation_id
        AND is_workspace_member(c.workspace_id)
    )
  );

-- ----------------------------------------
-- CONVERSATION PARTICIPANTS (via conversation workspace)
-- ----------------------------------------
CREATE POLICY "Members can read conversation participants"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_participants.conversation_id
        AND is_workspace_member(c.workspace_id)
    )
  );

CREATE POLICY "Members can manage conversation participants"
  ON conversation_participants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_participants.conversation_id
        AND is_workspace_member(c.workspace_id)
    )
  );

-- ----------------------------------------
-- AGENT MEMORY (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace memory"
  ON agent_memory FOR SELECT
  TO authenticated
  USING (is_workspace_member(agent_memory.workspace_id));

CREATE POLICY "Members can insert workspace memory"
  ON agent_memory FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(agent_memory.workspace_id));

-- ----------------------------------------
-- TASK EVENTS (workspace-scoped via task)
-- ----------------------------------------
CREATE POLICY "Members can read workspace task events"
  ON task_events FOR SELECT
  TO authenticated
  USING (is_workspace_member(task_events.workspace_id));

-- ----------------------------------------
-- APPROVALS (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace approvals"
  ON approvals FOR SELECT
  TO authenticated
  USING (is_workspace_member(approvals.workspace_id));

CREATE POLICY "Members can update workspace approvals"
  ON approvals FOR UPDATE
  TO authenticated
  USING (is_workspace_member(approvals.workspace_id));

-- ----------------------------------------
-- APP EVENTS (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace events"
  ON app_events FOR SELECT
  TO authenticated
  USING (is_workspace_member(app_events.workspace_id));

CREATE POLICY "Members can insert workspace events"
  ON app_events FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(app_events.workspace_id));

-- ----------------------------------------
-- SKILLS (GLOBAL)
-- ----------------------------------------
CREATE POLICY "Authenticated users can read skills"
  ON skills FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------
-- AGENT SKILLS (GLOBAL)
-- ----------------------------------------
CREATE POLICY "Authenticated users can read agent skills"
  ON agent_skills FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------
-- AGENT DEFINITIONS (GLOBAL)
-- ----------------------------------------
CREATE POLICY "Authenticated users can read definitions"
  ON agent_definitions FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------
-- PRODUCT CATALOG (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace catalog"
  ON product_catalog FOR SELECT
  TO authenticated
  USING (is_workspace_member(product_catalog.workspace_id));

CREATE POLICY "Members can manage workspace catalog"
  ON product_catalog FOR ALL
  TO authenticated
  USING (is_workspace_member(product_catalog.workspace_id));

-- ----------------------------------------
-- WORKFLOW DEFINITIONS (GLOBAL)
-- ----------------------------------------
CREATE POLICY "Authenticated users can read workflows"
  ON workflow_definitions FOR SELECT
  TO authenticated
  USING (true);

-- ----------------------------------------
-- KNOWLEDGE DOCUMENTS (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace knowledge docs"
  ON knowledge_documents FOR SELECT
  TO authenticated
  USING (is_workspace_member(knowledge_documents.workspace_id));

CREATE POLICY "Members can manage workspace knowledge docs"
  ON knowledge_documents FOR ALL
  TO authenticated
  USING (is_workspace_member(knowledge_documents.workspace_id));

-- ----------------------------------------
-- STRUCTURED LOGS (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace logs"
  ON structured_logs FOR SELECT
  TO authenticated
  USING (is_workspace_member(structured_logs.workspace_id));

CREATE POLICY "Members can insert workspace logs"
  ON structured_logs FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(structured_logs.workspace_id));

-- ----------------------------------------
-- METRICS (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace metrics"
  ON metrics FOR SELECT
  TO authenticated
  USING (is_workspace_member(metrics.workspace_id));

CREATE POLICY "Members can insert workspace metrics"
  ON metrics FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(metrics.workspace_id));

-- ----------------------------------------
-- TRACES (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace traces"
  ON traces FOR SELECT
  TO authenticated
  USING (is_workspace_member(traces.workspace_id));

CREATE POLICY "Members can insert workspace traces"
  ON traces FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(traces.workspace_id));

-- ----------------------------------------
-- SPANS (workspace-scoped via trace)
-- ----------------------------------------
CREATE POLICY "Members can read workspace spans"
  ON spans FOR SELECT
  TO authenticated
  USING (is_workspace_member(spans.workspace_id));

CREATE POLICY "Members can insert workspace spans"
  ON spans FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(spans.workspace_id));

-- ----------------------------------------
-- COST BUDGETS (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace budgets"
  ON cost_budgets FOR SELECT
  TO authenticated
  USING (is_workspace_member(cost_budgets.workspace_id));

CREATE POLICY "Admins can manage workspace budgets"
  ON cost_budgets FOR ALL
  TO authenticated
  USING (has_workspace_role(cost_budgets.workspace_id, 'admin'));

-- ----------------------------------------
-- COST RECORDS (workspace-scoped)
-- ----------------------------------------
CREATE POLICY "Members can read workspace cost records"
  ON cost_records FOR SELECT
  TO authenticated
  USING (is_workspace_member(cost_records.workspace_id));

CREATE POLICY "Members can insert workspace cost records"
  ON cost_records FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(cost_records.workspace_id));

-- ============================================
-- 7. WORKSPACE MEMBERS — fix auto-onboarding
-- ============================================
-- The trigger in migration 040 adds users as 'owner' of ws-default.
-- This is correct behavior. No changes needed.

-- ============================================
-- DONE
-- ============================================
-- After applying this migration:
-- 1. Every workspace-scoped table has workspace_id
-- 2. RLS policies check workspace membership via is_workspace_member()
-- 3. Global tables (providers, models, definitions, skills) remain readable by all
-- 4. Credentials remain accessible only via service role (never browser)
-- 5. The API routes (Phase 1.3) must be updated to pass workspace_id
