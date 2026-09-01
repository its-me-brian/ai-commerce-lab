-- App Events (Observability)
-- FASE 40: Centralized event logging for all platform actions.

CREATE TABLE IF NOT EXISTS app_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,       -- agent.run, agent.config_change, provider.test, system.startup, etc.
  severity TEXT NOT NULL DEFAULT 'info',  -- debug, info, warning, error, critical
  source TEXT,                     -- which module/component generated the event
  agent_id TEXT,                   -- optional: which agent was involved
  message TEXT NOT NULL,           -- human-readable description
  metadata JSONB DEFAULT '{}',    -- structured data (tokens, duration, model, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_events_type ON app_events(event_type);
CREATE INDEX IF NOT EXISTS idx_app_events_severity ON app_events(severity);
CREATE INDEX IF NOT EXISTS idx_app_events_agent ON app_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_app_events_created ON app_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_events_source ON app_events(source);

-- RLS
ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON app_events
  FOR ALL USING (true);

COMMENT ON TABLE app_events IS 'Centralized observability event log (FASE 40)';
