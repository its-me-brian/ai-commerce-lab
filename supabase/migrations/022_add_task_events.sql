-- Task Events (Audit Trail)
-- FASE 28: Tracks every status change, progress update, and event for tasks.

CREATE TABLE IF NOT EXISTS task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- status_change, progress_update, error, retry, cancel, delegate
  from_status TEXT,
  to_status TEXT,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by task
CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id);
-- Index for filtering by event type
CREATE INDEX IF NOT EXISTS idx_task_events_type ON task_events(event_type);
-- Index for chronological ordering
CREATE INDEX IF NOT EXISTS idx_task_events_created ON task_events(created_at);

COMMENT ON TABLE task_events IS 'Audit trail for task lifecycle events (FASE 28)';
