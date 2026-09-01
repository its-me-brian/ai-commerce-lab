-- Migration 033: Observability persistence
-- Creates tables for structured logs, metrics, and traces.
-- Replaces in-memory storage that loses data on restart.

-- ============================================
-- STRUCTURED LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS structured_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical')),
  component TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  trace_id TEXT,
  duration_ms INTEGER,
  success BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_structured_logs_severity ON structured_logs(severity);
CREATE INDEX idx_structured_logs_component ON structured_logs(component);
CREATE INDEX idx_structured_logs_trace_id ON structured_logs(trace_id);
CREATE INDEX idx_structured_logs_created_at ON structured_logs(created_at DESC);

-- ============================================
-- METRICS
-- ============================================
CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT,
  tags JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_metrics_name ON metrics(name);
CREATE INDEX idx_metrics_created_at ON metrics(created_at DESC);
CREATE INDEX idx_metrics_name_created ON metrics(name, created_at DESC);

-- ============================================
-- TRACES
-- ============================================
CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  root_span_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  agent_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'timeout')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_traces_status ON traces(status);
CREATE INDEX idx_traces_agent_id ON traces(agent_id);
CREATE INDEX idx_traces_started_at ON traces(started_at DESC);

-- ============================================
-- SPANS (child of traces)
-- ============================================
CREATE TABLE IF NOT EXISTS spans (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
  parent_span_id TEXT,
  operation TEXT NOT NULL,
  component TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'timeout')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  input JSONB,
  output JSONB,
  error TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_spans_trace_id ON spans(trace_id);
CREATE INDEX idx_spans_parent_span_id ON spans(parent_span_id);

-- ============================================
-- COST BUDGETS
-- ============================================
CREATE TABLE IF NOT EXISTS cost_budgets (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('agent', 'workflow', 'mini-ai', 'global')),
  max_dollars DOUBLE PRECISION NOT NULL,
  window TEXT NOT NULL DEFAULT 'day',
  description TEXT,
  alert_thresholds JSONB DEFAULT '[0.5, 0.75, 0.9]',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_budgets_entity ON cost_budgets(entity_id, entity_type);

-- ============================================
-- COST RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS cost_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  cost_dollars DOUBLE PRECISION NOT NULL,
  provider TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  task_id TEXT,
  run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_records_entity ON cost_records(entity_id, entity_type);
CREATE INDEX idx_cost_records_created_at ON cost_records(created_at DESC);

-- ============================================
-- RETENTION: auto-cleanup old logs (30 days)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_old_structured_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM structured_logs WHERE created_at < now() - INTERVAL '30 days';
  DELETE FROM metrics WHERE created_at < now() - INTERVAL '30 days';
  DELETE FROM spans WHERE trace_id IN (
    SELECT id FROM traces WHERE started_at < now() - INTERVAL '30 days'
  );
  DELETE FROM traces WHERE started_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
