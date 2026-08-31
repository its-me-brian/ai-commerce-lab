-- FASE 2: Agent Hierarchy
-- Adds parent_agent_id, agent_type, department, workspace_id to agents table.
-- Enables organizational hierarchy: CEO → Department Heads → Specialists.

-- ============================================
-- NEW COLUMNS
-- ============================================

-- Who this agent reports to (hierarchy tree)
ALTER TABLE agents ADD COLUMN parent_agent_id TEXT REFERENCES agents(id);

-- Agent classification: executive | department | specialist
ALTER TABLE agents ADD COLUMN agent_type TEXT DEFAULT 'specialist' NOT NULL;

-- Organizational department
ALTER TABLE agents ADD COLUMN department TEXT;

-- Workspace scope (null = global/default workspace)
ALTER TABLE agents ADD COLUMN workspace_id TEXT REFERENCES workspaces(id);

-- ============================================
-- SEED HIERARCHY
-- ============================================

-- CEO: top-level executive
UPDATE agents SET parent_agent_id = NULL, agent_type = 'executive', department = 'executive'
  WHERE id = 'ceo';

-- Department Heads (report to CEO)
UPDATE agents SET parent_agent_id = 'ceo', agent_type = 'department', department = 'product'
  WHERE id = 'product-hunter';

UPDATE agents SET parent_agent_id = 'ceo', agent_type = 'department', department = 'marketing'
  WHERE id = 'marketing';

UPDATE agents SET parent_agent_id = 'ceo', agent_type = 'department', department = 'finance'
  WHERE id = 'finance';

UPDATE agents SET parent_agent_id = 'ceo', agent_type = 'department', department = 'operations'
  WHERE id = 'secretary';

UPDATE agents SET parent_agent_id = 'ceo', agent_type = 'department', department = 'operations'
  WHERE id = 'store-builder';

-- Specialists (report to Product Hunter)
UPDATE agents SET parent_agent_id = 'product-hunter', agent_type = 'specialist', department = 'product'
  WHERE id = 'market-research';

UPDATE agents SET parent_agent_id = 'product-hunter', agent_type = 'specialist', department = 'product'
  WHERE id = 'supplier-research';

UPDATE agents SET parent_agent_id = 'product-hunter', agent_type = 'specialist', department = 'product'
  WHERE id = 'opportunity-scoring';

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_agents_parent ON agents(parent_agent_id);
CREATE INDEX idx_agents_type ON agents(agent_type);
CREATE INDEX idx_agents_department ON agents(department);
CREATE INDEX idx_agents_workspace ON agents(workspace_id);

-- ============================================
-- CONSTRAINTS
-- ============================================

-- agent_type must be one of the valid values
ALTER TABLE agents ADD CONSTRAINT chk_agent_type
  CHECK (agent_type IN ('executive', 'department', 'specialist'));

-- An agent cannot be its own parent
ALTER TABLE agents ADD CONSTRAINT chk_agent_no_self_parent
  CHECK (parent_agent_id != id);
