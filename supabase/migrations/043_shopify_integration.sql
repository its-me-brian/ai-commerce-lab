-- Migration 043: Shopify integration tables
-- Stores Shopify store connections and sync state.

-- ============================================
-- SHOPIFY STORES
-- ============================================
CREATE TABLE IF NOT EXISTS shopify_stores (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Shopify details
  shop_domain TEXT NOT NULL,              -- e.g. "my-store.myshopify.com"
  access_token TEXT NOT NULL,             -- encrypted via CredentialManager in production
  scope TEXT,                             -- OAuth scopes granted

  -- Store info (cached from Shopify API)
  store_name TEXT,
  store_email TEXT,
  currency TEXT DEFAULT 'USD',
  plan_name TEXT,

  -- Sync state
  last_products_sync_at TIMESTAMPTZ,
  last_orders_sync_at TIMESTAMPTZ,
  products_count INTEGER DEFAULT 0,
  orders_count INTEGER DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'error')),
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One store per workspace
  UNIQUE(workspace_id, shop_domain)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shopify_stores_workspace ON shopify_stores(workspace_id);

-- RLS
ALTER TABLE shopify_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopify_stores_select" ON shopify_stores
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "shopify_stores_insert" ON shopify_stores
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "shopify_stores_update" ON shopify_stores
  FOR UPDATE USING (has_workspace_role(workspace_id, 'admin'));

CREATE POLICY "shopify_stores_delete" ON shopify_stores
  FOR DELETE USING (has_workspace_role(workspace_id, 'owner'));

-- ============================================
-- PRODUCT CATALOG — add source_id unique constraint
-- ============================================
-- Ensures no duplicate products per workspace from the same source
ALTER TABLE product_catalog ADD CONSTRAINT unique_product_catalog_workspace_source
  UNIQUE (workspace_id, source_id);
