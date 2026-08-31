import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/ai/bootstrap";
import { getRouter } from "@/lib/ai/router";
import type { AIProviderSlug } from "@/lib/ai/types";

// POST /api/ai/test
// Tests connection to an AI provider using the provider abstraction.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, model } = body as {
      provider: AIProviderSlug;
      model: string;
    };

    if (!provider || !model) {
      return NextResponse.json(
        { success: false, error: "provider and model are required" },
        { status: 400 }
      );
    }

    // Ensure providers are registered
    bootstrap();

    const router = getRouter();
    const providerInstance = router.getProvider(provider);

    if (!providerInstance) {
      return NextResponse.json(
        { success: false, error: `Unknown provider: ${provider}` },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const result = await providerInstance.testConnection(model);

    return NextResponse.json({
      success: result.success,
      provider,
      model,
      latencyMs: Date.now() - startTime,
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
