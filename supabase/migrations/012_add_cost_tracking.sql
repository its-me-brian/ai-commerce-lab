-- AI Commerce Lab — Add cost tracking to agent_runs
-- Run this in Supabase SQL Editor

-- Add cost column to agent_runs
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS cost DECIMAL(10,6) DEFAULT 0;

-- Add cost to agent_tasks for aggregated cost per task
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10,6) DEFAULT 0;

-- Add total_tokens to agent_runs for convenience
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS total_tokens INTEGER DEFAULT 0;
