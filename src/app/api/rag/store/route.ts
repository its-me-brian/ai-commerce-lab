// RAG Store API
// Accepts pre-computed embeddings from client-side Browser ML.
// Stores documents with embeddings to Supabase.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-auth";
import { supabase } from "@/lib/database/supabase";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const { workspace_id, title, content, embedding, source_type, source_url, category, tags, metadata } = body;

    if (!workspace_id || !title || !content || !embedding) {
      return NextResponse.json(
        { error: "Missing required fields: workspace_id, title, content, embedding" },
        { status: 400 }
      );
    }

    if (!Array.isArray(embedding) || embedding.length !== 384) {
      return NextResponse.json(
        { error: "Embedding must be a 384-dimensional number array" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("knowledge_documents")
      .insert({
        workspace_id,
        title,
        content,
        source_type: source_type || "manual",
        source_url: source_url || null,
        category: category || "general",
        tags: tags || [],
        embedding,
        metadata: metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ document: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
