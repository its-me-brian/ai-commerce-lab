-- Approvals (Human-in-the-Loop)
-- FASE 29: Agents pause and request human approval before critical actions.

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES agent_tasks(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'product_listing', 'price_change', 'supplier_order', 'marketing_campaign', 'refund'
  action_summary TEXT NOT NULL,
  action_details JSONB NOT NULL DEFAULT '{}',
  risk_level TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, expired, cancelled
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_agent ON approvals(agent_id);
CREATE INDEX IF NOT EXISTS idx_approvals_task ON approvals(task_id);
CREATE INDEX IF NOT EXISTS idx_approvals_created ON approvals(created_at);

-- RLS
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON approvals FOR ALL USING (true);

COMMENT ON TABLE approvals IS 'Human-in-the-loop approval requests (FASE 29)';
