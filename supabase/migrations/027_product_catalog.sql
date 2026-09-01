-- Migration 027: Product Catalog
-- Stores products discovered by Product Hunter for browsing and management.

CREATE TABLE IF NOT EXISTS product_catalog (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,

  -- Product data (from Product Hunter discovery)
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  supplier_price NUMERIC(10,2),
  selling_price NUMERIC(10,2),
  currency TEXT DEFAULT 'EUR',
  image_url TEXT,
  source TEXT,           -- 'dummyjson', 'manual', etc.
  source_id TEXT,
  source_url TEXT,

  -- Scoring (from Opportunity Scoring)
  overall_score NUMERIC(5,2),
  decision TEXT,         -- 'GO', 'CONDITIONAL_GO', 'NO_GO', 'NEEDS_MORE_DATA'
  risk_level TEXT,       -- 'low', 'medium', 'high'

  -- Status pipeline
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN (
    'discovered',    -- Just found by Product Hunter
    'evaluating',    -- Under review
    'approved',      -- Ready to launch
    'listed',        -- Listed in store
    'rejected',      -- Not a good fit
    'archived'       -- No longer active
  )),

  -- Store content (from Store Builder)
  store_content JSONB,  -- Full store listing data
  seo JSONB,            -- SEO metadata

  -- Marketing (from Marketing agent)
  marketing_content JSONB,

  -- Finance (from Finance agent)
  finance_analysis JSONB,

  -- Tags and notes
  tags JSONB DEFAULT '[]',
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_catalog_status ON product_catalog(status);
CREATE INDEX IF NOT EXISTS idx_product_catalog_category ON product_catalog(category);
CREATE INDEX IF NOT EXISTS idx_product_catalog_score ON product_catalog(overall_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_product_catalog_workspace ON product_catalog(workspace_id);

-- Row Level Security
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to product_catalog"
  ON product_catalog FOR ALL
  USING (true)
  WITH CHECK (true);
