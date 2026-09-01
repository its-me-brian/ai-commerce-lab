import { NextRequest, NextResponse } from "next/server";
import { getProviderStatuses } from "@/lib/ai/provider-test";
import { supabase } from "@/lib/database/supabase";

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

// PATCH /api/ai/providers
// Enable/disable a provider by slug
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, slug, enabled } = body as { id?: string; slug?: string; enabled?: boolean };

    const identifier = slug || id;
    if (!identifier || typeof enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "slug (or id) and enabled (boolean) are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("ai_providers")
      .update({ enabled })
      .eq("slug", identifier)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, provider: data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
