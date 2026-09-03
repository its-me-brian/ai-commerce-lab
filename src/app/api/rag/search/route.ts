// RAG Search API
// Accepts pre-computed query embedding from client-side Browser ML.
// Performs cosine similarity search against stored embeddings.

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { supabase } from "@/lib/database/supabase";

/** Cosine similarity between two vectors. */
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

export async function POST(request: NextRequest) {
  const authResult = await requireWorkspaceAccess(request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const { workspaceId } = authResult;

  try {
    const body = await request.json();
    const { query_embedding, limit, min_score, category } = body;
    const workspace_id = workspaceId;

    if (!query_embedding) {
      return NextResponse.json(
        { error: "Missing required field: query_embedding" },
        { status: 400 }
      );
    }

    if (!Array.isArray(query_embedding) || query_embedding.length !== 384) {
      return NextResponse.json(
        { error: "query_embedding must be a 384-dimensional number array" },
        { status: 400 }
      );
    }

    const maxResults = Math.min(limit || 5, 20);
    const minScore = min_score ?? 0.3;

    // Fetch all documents for workspace (in-memory search for now)
    let queryBuilder = supabase
      .from("knowledge_documents")
      .select("*")
      .eq("workspace_id", workspace_id);

    if (category) {
      queryBuilder = queryBuilder.eq("category", category);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const documents = data || [];

    // Compute similarity scores
    const scored: Array<{ document: typeof documents[0]; score: number }> = [];
    for (const doc of documents) {
      if (!doc.embedding) continue;
      const score = cosineSimilarity(query_embedding, doc.embedding);
      if (score >= minScore) {
        scored.push({ document: doc, score });
      }
    }

    // Sort by score descending, return top N
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, maxResults);

    return NextResponse.json({
      results: results.map((r) => ({
        id: r.document.id,
        title: r.document.title,
        content: r.document.content,
        category: r.document.category,
        score: r.score,
      })),
      total: results.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
