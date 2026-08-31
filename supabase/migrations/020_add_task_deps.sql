-- Migration 020: Task Dependencies
-- FASE 14: Task Engine v2 with dependency tracking.
-- Adds depends_on (array of task IDs) and parent_task_id for subtask tracking.

ALTER TABLE agent_tasks
ADD COLUMN IF NOT EXISTS depends_on TEXT[] DEFAULT '{}';

ALTER TABLE agent_tasks
ADD COLUMN IF NOT EXISTS parent_task_id TEXT REFERENCES agent_tasks(id) ON DELETE SET NULL;

-- Index for dependency queries
CREATE INDEX IF NOT EXISTS idx_agent_tasks_depends ON agent_tasks USING GIN (depends_on);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_parent ON agent_tasks(parent_task_id);
