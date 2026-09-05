import { NextRequest, NextResponse } from "next/server";
import { getProviderStatuses } from "@/lib/ai/provider-test";
import { supabase } from "@/lib/database/supabase";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { sanitizeBody } from "@/lib/security/sanitize";

// GET /api/ai/providers
// Lists all registered providers with their configuration status.
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const access = await requireWorkspaceAccess(request);
    if ("error" in access) return access.error;

    const providers = await getProviderStatuses(access.workspaceId);
    return NextResponse.json({ success: true, providers });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

// PATCH /api/ai/providers
// Enable/disable a provider by slug
export async function PATCH(request: NextRequest) {
  try {
    // Auth check
    const access = await requireWorkspaceAccess(request);
    if ("error" in access) return access.error;

    const body = sanitizeBody(await request.json()) as Record<string, unknown>;
    const identifier = (body.slug || body.id) as string;
    const enabled = body.enabled as boolean;

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
      return NextResponse.json({ success: false, error: "Failed to update provider" }, { status: 500 });
    }

    return NextResponse.json({ success: true, provider: data });
  } catch {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
