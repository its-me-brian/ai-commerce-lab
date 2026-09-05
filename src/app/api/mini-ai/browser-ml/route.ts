// GET /api/mini-ai/browser-ml — Returns available browser-ml models.
// POST /api/mini-ai/browser-ml — Proxy for server-side browser-ml inference (fallback).

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/api-auth";
import { logger } from "@/lib/logging";

const AVAILABLE_MODELS = [
  {
    id: "Xenova/all-MiniLM-L6-v2",
    task: "feature-extraction",
    name: "MiniLM L6 v2",
    description: "Fast sentence embeddings (23MB, quantized)",
    size: "~23MB",
    capabilities: ["embedding", "similarity", "clustering"],
  },
  {
    id: "Xenova/distilbert-base-uncased-finetuned-sst-2-english",
    task: "text-classification",
    name: "DistilBERT SST-2",
    description: "Sentiment analysis (67MB)",
    size: "~67MB",
    capabilities: ["sentiment", "classification"],
  },
  {
    id: "Xenova/bert-base-NER",
    task: "token-classification",
    name: "BERT NER",
    description: "Named entity recognition (440MB)",
    size: "~440MB",
    capabilities: ["ner", "entity-extraction"],
  },
];

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth.error;

  return NextResponse.json({
    success: true,
    models: AVAILABLE_MODELS,
    note: "These models run in the browser via Transformers.js + ONNX Runtime Web. No server compute required.",
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth.error;

  // Server-side fallback: if browser-ml is not available (e.g., SSR),
  // return a placeholder indicating the model should run client-side.
  try {
    const body = await request.json();
    const { model, input } = body as { model: string; input: string };

    if (!model || !input) {
      return NextResponse.json(
        { success: false, error: "model and input are required" },
        { status: 400 }
      );
    }

    // Server can't run ONNX models — return guidance
    return NextResponse.json({
      success: false,
      error: "Browser-ML models must run client-side. Use the useBrowserML() hook.",
      hint: {
        hook: "useBrowserML()",
        example: `
          const { loadModel, inference } = useBrowserML();
          await loadModel("${model}", "feature-extraction");
          const result = await inference("${input.slice(0, 50)}...");
        `,
      },
    });
  } catch (error) {
    logger.error("Route handler error", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
