-- Migration 030: Knowledge documents for RAG
-- Stores documents with embeddings for retrieval-augmented generation.

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'scraped', 'imported', 'generated')),
  source_url TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  tags JSONB NOT NULL DEFAULT '[]',
  embedding JSONB,  -- 384-dim vector stored as JSON array (pgvector later)
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_workspace ON knowledge_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_category ON knowledge_documents(workspace_id, category);

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to knowledge_documents"
  ON knowledge_documents FOR ALL
  USING (true)
  WITH CHECK (true);
