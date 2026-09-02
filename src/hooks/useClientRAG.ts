// useClientRAG — Client-side RAG using Browser ML for ONNX embeddings.
//
// Replaces hash-based embeddings with real ONNX embeddings from Transformers.js.
// Stores/retrieves documents via API endpoints (server handles Supabase).
//
// Usage:
//   const { storeDocument, search, loading, error } = useClientRAG("ws-default");

"use client";

import { useState, useCallback, useRef } from "react";
import { getBrowserMLProvider } from "@/lib/ai/mini-ai/browser-ml/provider";

const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_TASK = "feature-extraction";
const EMBEDDING_DIM = 384;

export interface RAGDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  score: number;
}

export interface StoreDocumentInput {
  title: string;
  content: string;
  source_type?: string;
  source_url?: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UseClientRAGReturn {
  /** Store a document with ONNX-computed embedding */
  storeDocument: (input: StoreDocumentInput) => Promise<{ id: string } | null>;
  /** Search documents using ONNX query embedding */
  search: (query: string, options?: { limit?: number; minScore?: number; category?: string }) => Promise<RAGDocument[]>;
  /** Whether an operation is in progress */
  loading: boolean;
  /** Current error message */
  error: string | null;
  /** Whether the embedding model is loaded */
  modelReady: boolean;
  /** Load the embedding model (auto-called on first use) */
  ensureModel: () => Promise<void>;
}

/**
 * Extract embedding from Browser ML feature-extraction output.
 * Xenova/all-MiniLM-L6-v2 returns { data: Float32Array } or number[].
 */
function extractEmbedding(output: unknown): number[] {
  if (!output) return [];

  // Handle different output formats from Transformers.js
  if (Array.isArray(output)) {
    return output.slice(0, EMBEDDING_DIM);
  }

  if (typeof output === "object" && output !== null) {
    const obj = output as Record<string, unknown>;

    // { data: Float32Array } format
    if (obj.data && typeof obj.data !== "string") {
      const data = obj.data;
      if (Array.isArray(data)) {
        return data.slice(0, EMBEDDING_DIM);
      }
      // Float32Array or similar
      if (typeof data === "object" && "length" in data) {
        return Array.from(data as Float32Array).slice(0, EMBEDDING_DIM);
      }
    }

    // { embeddings: number[][] } format — take first
    if (obj.embeddings && Array.isArray(obj.embeddings)) {
      const first = obj.embeddings[0];
      if (Array.isArray(first)) {
        return first.slice(0, EMBEDDING_DIM);
      }
    }

    // { sentence_embedding: number[] } format
    if (obj.sentence_embedding && Array.isArray(obj.sentence_embedding)) {
      return obj.sentence_embedding.slice(0, EMBEDDING_DIM);
    }
  }

  return [];
}

export function useClientRAG(workspaceId: string): UseClientRAGReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const providerRef = useRef(getBrowserMLProvider());

  const ensureModel = useCallback(async () => {
    if (modelReady) return;

    try {
      await providerRef.current.loadModel(EMBEDDING_MODEL, EMBEDDING_TASK);
      setModelReady(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load embedding model: ${msg}`);
      throw err;
    }
  }, [modelReady]);

  const computeEmbedding = useCallback(async (text: string): Promise<number[]> => {
    await ensureModel();

    const result = await providerRef.current.inference(text);
    if (!result) {
      throw new Error("Embedding inference returned null");
    }

    const embedding = extractEmbedding(result.output);
    if (embedding.length === 0) {
      throw new Error("Failed to extract embedding from model output");
    }

    return embedding;
  }, [ensureModel]);

  const storeDocument = useCallback(async (input: StoreDocumentInput): Promise<{ id: string } | null> => {
    setLoading(true);
    setError(null);

    try {
      const embedding = await computeEmbedding(input.content);

      const response = await fetch("/api/rag/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          ...input,
          embedding,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const { document } = await response.json();
      return { id: document.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [workspaceId, computeEmbedding]);

  const search = useCallback(async (
    query: string,
    options?: { limit?: number; minScore?: number; category?: string }
  ): Promise<RAGDocument[]> => {
    setLoading(true);
    setError(null);

    try {
      const query_embedding = await computeEmbedding(query);

      const response = await fetch("/api/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          query_embedding,
          limit: options?.limit,
          min_score: options?.minScore,
          category: options?.category,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const { results } = await response.json();
      return results;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [workspaceId, computeEmbedding]);

  return {
    storeDocument,
    search,
    loading,
    error,
    modelReady,
    ensureModel,
  };
}
