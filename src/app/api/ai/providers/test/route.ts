import { NextResponse } from "next/server";
import { testProviderConnection } from "@/lib/ai/provider-test";

// POST /api/ai/providers/test
// Tests connection to a specific AI provider.
// Body: { provider: string, model?: string }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, model } = body as {
      provider?: string;
      model?: string;
    };

    if (!provider) {
      return NextResponse.json(
        { success: false, error: "provider is required" },
        { status: 400 }
      );
    }

    const result = await testProviderConnection({ provider, model });

    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
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
