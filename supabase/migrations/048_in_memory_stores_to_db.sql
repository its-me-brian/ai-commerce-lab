-- Migration 048: In-Memory Stores to Database
-- Migrates critical in-memory stores to Supabase for persistence across restarts:
-- 1. security_audit_logs — SecurityAudit events
-- 2. execution_evaluations — EvaluationEngine results
-- 3. agent_handoffs — AgentHandoffManager state
-- Idempotent: safe to re-run if partially applied.

-- ============================================
-- 1. SECURITY AUDIT LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS security_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  source TEXT NOT NULL,
  client_id TEXT,
  sanitized_input TEXT,
  metadata JSONB,
  workspace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_severity ON security_audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_audit_client ON security_audit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_workspace ON security_audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_logs(created_at);

ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role full access" ON security_audit_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert" ON security_audit_logs
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read own workspace" ON security_audit_logs
    FOR SELECT TO authenticated
    USING (workspace_id IS NULL OR is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION cleanup_security_audit_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM security_audit_logs
  WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. EXECUTION EVALUATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS execution_evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  overall_score NUMERIC(5,4) NOT NULL,
  signals JSONB NOT NULL DEFAULT '[]',
  duration_ms BIGINT NOT NULL,
  cost_dollars NUMERIC(10,6) NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL,
  retries INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER,
  output_tokens INTEGER,
  feedback TEXT,
  passed BOOLEAN NOT NULL,
  workspace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evaluations_workspace ON execution_evaluations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_passed ON execution_evaluations(passed);
CREATE INDEX IF NOT EXISTS idx_evaluations_created ON execution_evaluations(created_at);

ALTER TABLE execution_evaluations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role full access" ON execution_evaluations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert" ON execution_evaluations
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read own workspace" ON execution_evaluations
    FOR SELECT TO authenticated
    USING (workspace_id IS NULL OR is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION cleanup_execution_evaluations()
RETURNS void AS $$
BEGIN
  DELETE FROM execution_evaluations
  WHERE created_at < now() - interval '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. AGENT HANDOFFS
-- ============================================

CREATE TABLE IF NOT EXISTS agent_handoffs (
  id TEXT PRIMARY KEY,
  source_agent_id TEXT NOT NULL,
  target_agent_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('request', 'transfer', 'return')),
  action TEXT NOT NULL,
  context JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'returned')),
  result JSONB,
  workspace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_handoffs_source ON agent_handoffs(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_target ON agent_handoffs(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_handoffs_status ON agent_handoffs(status);
CREATE INDEX IF NOT EXISTS idx_handoffs_workspace ON agent_handoffs(workspace_id);

ALTER TABLE agent_handoffs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role full access" ON agent_handoffs
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert" ON agent_handoffs
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read own workspace" ON agent_handoffs
    FOR SELECT TO authenticated
    USING (workspace_id IS NULL OR is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update own workspace" ON agent_handoffs
    FOR UPDATE TO authenticated
    USING (workspace_id IS NULL OR is_workspace_member(workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION cleanup_agent_handoffs()
RETURNS void AS $$
BEGIN
  DELETE FROM agent_handoffs
  WHERE status IN ('completed', 'failed', 'returned')
    AND updated_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql;
