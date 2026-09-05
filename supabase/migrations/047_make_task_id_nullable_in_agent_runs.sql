-- Migration 045: Make task_id nullable in agent_runs
-- Chat flows (multiAgentChat) don't create tasks — they log runs without a task_id.

ALTER TABLE agent_runs ALTER COLUMN task_id DROP NOT NULL;
