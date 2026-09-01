// RAG Service
// Retrieval-Augmented Generation: stores knowledge documents and retrieves
// relevant context for agent executions.
//
// Architecture:
//   - Documents stored in Supabase (knowledge_documents table)
//   - Embeddings generated via AIModelRouter (embedding model or fallback to text hashing)
//   - Similarity search via cosine distance (in-memory for now, pgvector later)
//
// F7: Minimal viable RAG for agent context injection.

// Lazy import — only loaded when no client is injected (production use)
let _supabaseClient: SupabaseClient | null = null;
async function getDefaultClient(): Promise<SupabaseClient> {
  if (!_supabaseClient) {
    const { supabase } = await import("../database/supabase");
    _supabaseClient = supabase;
  }
  return _supabaseClient;
}

// ============================================
// TYPES
// ============================================

/** Minimal Supabase client interface for DI */
export interface SupabaseQueryChain {
  select: (cols?: string) => SupabaseQueryChain;
  insert: (row: Record<string, unknown>) => SupabaseQueryChain;
  eq: (col: string, val: unknown) => SupabaseQueryChain;
  order: (col: string, opts?: Record<string, unknown>) => SupabaseQueryChain;
  limit: (n: number) => SupabaseQueryChain;
  delete: () => SupabaseQueryChain;
  single: () => SupabaseQueryChain;
  then: <T>(resolve: (v: { data: T | null; error: unknown }) => void) => unknown;
}

export interface SupabaseClient {
  from: (table: string) => SupabaseQueryChain;
}

export interface KnowledgeDocument {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  source_type: "manual" | "scraped" | "imported" | "generated";
  source_url?: string;
  category: string;
  tags: string[];
  /** Pre-computed embedding vector (384 dimensions for mini embeddings) */
  embedding?: number[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StoreDocumentInput {
  workspace_id: string;
  title: string;
  content: string;
  source_type?: KnowledgeDocument["source_type"];
  source_url?: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  document: KnowledgeDocument;
  score: number;
}

// ============================================
// EMBEDDING (lightweight — no external API)
// ============================================

/**
 * Generate a simple embedding vector from text.
 * Uses a lightweight hash-based approach (384 dimensions).
 * For production, replace with a real embedding model (e.g., text-embedding-3-small).
 */
function generateEmbedding(text: string): number[] {
  const dim = 384;
  const vec = new Array<number>(dim).fill(0);
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, " ");

  // Tokenize and distribute energy across dimensions
  const words = normalized.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Simple hash per word
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash + word.charCodeAt(j)) | 0;
    }
    // Distribute across dimensions using word position as salt
    const baseIdx = Math.abs(hash) % dim;
    const spread = 3;
    for (let k = -spread; k <= spread; k++) {
      const idx = (baseIdx + k + dim) % dim;
      vec[idx] += 1.0 / (1 + Math.abs(k));
    }
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;

  return vec;
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// ============================================
// RAG SERVICE
// ============================================

export class RAGService {
  private db: SupabaseClient | null;

  constructor(db?: SupabaseClient) {
    this.db = db ?? null;
  }

  /** Get the DB client — injected or lazy-loaded from module */
  private async getClient(): Promise<SupabaseClient> {
    return this.db ?? getDefaultClient();
  }

  /**
   * Store a knowledge document with computed embedding.
   */
  async storeDocument(input: StoreDocumentInput): Promise<KnowledgeDocument> {
    const embedding = generateEmbedding(input.content);
    const db = await this.getClient();

    const { data, error } = await db
      .from("knowledge_documents")
      .insert({
        workspace_id: input.workspace_id,
        title: input.title,
        content: input.content,
        source_type: input.source_type || "manual",
        source_url: input.source_url || null,
        category: input.category || "general",
        tags: input.tags || [],
        embedding,
        metadata: input.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to store document: ${error?.message}`);
    }

    return data as KnowledgeDocument;
  }

  /**
   * Retrieve relevant documents for a query.
   * Computes query embedding and finds most similar documents.
   */
  async retrieve(
    workspaceId: string,
    query: string,
    options?: { limit?: number; minScore?: number; category?: string }
  ): Promise<SearchResult[]> {
    const limit = options?.limit ?? 5;
    const minScore = options?.minScore ?? 0.3;

    // Fetch all documents for workspace (in-memory search for now)
    const db = await this.getClient();
    let queryBuilder = db
      .from("knowledge_documents")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (options?.category) {
      queryBuilder = queryBuilder.eq("category", options.category);
    }

    const { data, error } = await queryBuilder;

    if (error || !data) return [];

    const documents = data as KnowledgeDocument[];
    const queryEmbedding = generateEmbedding(query);

    // Compute similarity scores
    const scored: SearchResult[] = [];
    for (const doc of documents) {
      if (!doc.embedding) continue;
      const score = cosineSimilarity(queryEmbedding, doc.embedding);
      if (score >= minScore) {
        scored.push({ document: doc, score });
      }
    }

    // Sort by score descending, return top N
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  /**
   * Get document by ID.
   */
  async getDocument(id: string): Promise<KnowledgeDocument | null> {
    const db = await this.getClient();
    const { data, error } = await db
      .from("knowledge_documents")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as KnowledgeDocument;
  }

  /**
   * List all documents for a workspace.
   */
  async listDocuments(
    workspaceId: string,
    options?: { category?: string; limit?: number }
  ): Promise<KnowledgeDocument[]> {
    const db = await this.getClient();
    let query = db
      .from("knowledge_documents")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (options?.category) {
      query = query.eq("category", options.category);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as KnowledgeDocument[];
  }

  /**
   * Delete a document.
   */
  async deleteDocument(id: string): Promise<boolean> {
    const db = await this.getClient();
    const { error } = await db
      .from("knowledge_documents")
      .delete()
      .eq("id", id);

    return !error;
  }

  /**
   * Build context string from retrieved documents for injection into agent prompts.
   */
  buildContext(results: SearchResult[]): string {
    if (results.length === 0) return "";

    const lines = ["## Relevant Knowledge"];

    for (const r of results) {
      const scorePct = Math.round(r.score * 100);
      lines.push(`### ${r.document.title} (${scorePct}% relevance)`);
      // Truncate content to keep context manageable
      const maxLen = 500;
      const content = r.document.content.length > maxLen
        ? r.document.content.slice(0, maxLen) + "..."
        : r.document.content;
      lines.push(content);
      lines.push("");
    }

    return lines.join("\n");
  }
}

// Singleton
let instance: RAGService | null = null;

export function getRAGService(): RAGService {
  if (!instance) {
    instance = new RAGService();
  }
  return instance;
}

export function resetRAGService(): void {
  instance = null;
}
