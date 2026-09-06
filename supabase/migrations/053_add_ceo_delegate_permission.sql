-- 053: Add delegate_to permission for CEO agent
-- Fixes delegation not working because permission was missing
-- workspace_id is NOT NULL (FK to workspaces), use ws-default (default workspace)

INSERT INTO agent_permissions (agent_id, action, target, granted, workspace_id) VALUES
  ('ceo', 'delegate_to', '*', true, 'ws-default')
ON CONFLICT (agent_id, action, target) DO UPDATE SET granted = true;

-- Also ensure CEO has admin role (in case migration 002-010 wasn't fully applied)
UPDATE agents SET role = 'admin' WHERE id = 'ceo';
