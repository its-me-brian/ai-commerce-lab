// Settings Provider Test API
// Consolidated endpoint — uses shared provider-test service.
// PHASE 10: Removed duplicate inline test functions, now uses provider-test.ts.

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { testProviderConnection } from "@/lib/ai/provider-test";
import { withSecurity } from "@/lib/security/api-middleware";

/**
 * POST /api/settings/providers/test
 * Test a provider connection using vault credentials.
 * Body: { provider: string, model?: string }
 *
 * Consolidated with /api/ai/providers/test — both now use the same service.
 */
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const access = await requireWorkspaceAccess(request);
    if ("error" in access) return access.error;

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
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});
