import { NextResponse } from "next/server";
import { getProviderStatuses } from "@/lib/ai/provider-test";

// GET /api/ai/providers
// Lists all registered providers with their configuration status.
export async function GET() {
  try {
    const providers = await getProviderStatuses();
    return NextResponse.json({ success: true, providers });
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
