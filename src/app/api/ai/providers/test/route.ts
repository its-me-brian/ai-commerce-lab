import { NextRequest, NextResponse } from "next/server";
import { testProviderConnection } from "@/lib/ai/provider-test";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";
import { logger } from "@/lib/logging";

// POST /api/ai/providers/test
// Tests connection to a specific AI provider.
// Body: { provider: string, model?: string }
export const POST = withSecurity(async (request: NextRequest) => {
  const access = await requireWorkspaceAccess(request);
  if ("error" in access) return access.error;

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

    const result = await testProviderConnection({ provider, model }, access.workspaceId);

    return NextResponse.json(result, {
      status: result.success ? 200 : 422,
    });
  } catch (error) {
    logger.error("Route handler error", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});
