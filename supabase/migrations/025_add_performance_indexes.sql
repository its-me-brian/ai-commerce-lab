-- Performance Indexes
-- FASE 45: Add missing indexes for hot query paths.

-- agent_tasks: queried by agent_id, status, created_at constantly
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent ON agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created ON agent_tasks(created_at DESC);
-- Composite: agent + status (used in dashboard KPI queries)
CREATE INDEX IF NOT EXISTS idx_agent_tasks_agent_status ON agent_tasks(agent_id, status);

-- agent_runs: queried by agent for run history, by status for dashboard
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_task ON agent_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs(created_at DESC);
-- Composite: agent + created (run history pagination)
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_created ON agent_runs(agent_id, created_at DESC);

-- agent_configs: looked up by agent_id (should be unique but explicit index helps)
CREATE INDEX IF NOT EXISTS idx_agent_configs_agent ON agent_configs(agent_id);

-- skills: looked up by slug
CREATE INDEX IF NOT EXISTS idx_skills_slug ON skills(slug);

-- agent_skills: looked up by agent_id to get agent's skills
CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON agent_skills(agent_id);
