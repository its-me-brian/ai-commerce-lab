import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceService } from "@/lib/workspaces/service";
import { requireAuth, requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";
import { logger } from "@/lib/logging";

// GET /api/workspaces
// V1: Returns the user's current workspace (auto-resolved).
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    // V1: Use requireWorkspaceAccess to auto-resolve user's workspace
    const auth = await requireWorkspaceAccess(request);
    if ("error" in auth) return auth.error;

    const service = getWorkspaceService();
    const workspace = await service.get(auth.workspaceId);

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: "Workspace not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, workspace, workspaces: [workspace] });
  } catch (error) {
    logger.error("Route handler error", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
});

// POST /api/workspaces
// Create a new workspace.
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // Auth check
    const auth = await requireAuth(request);
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { name, description, target_country, currency, target_customer, brand_voice, target_margin, supplier_countries } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "name is required" } },
        { status: 400 }
      );
    }

    const service = getWorkspaceService();
    const workspace = await service.create({
      id: `ws-${Date.now()}`,
      name,
      description: description || null,
      target_country: target_country || "ES",
      currency: currency || "EUR",
      target_customer: target_customer || null,
      brand_voice: brand_voice || null,
      target_margin: target_margin || 3.0,
      supplier_countries: supplier_countries || [],
      business_rules: {},
      approval_rules: {},
      personality_overrides: null,
    });

    if (!workspace) {
      return NextResponse.json(
        { error: { code: "CREATE_FAILED", message: "Failed to create workspace" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, workspace });
  } catch (error) {
    logger.error("Route handler error", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create workspace" } },
      { status: 500 }
    );
  }
});

// PUT /api/workspaces
// Update an existing workspace — requires admin role.
export const PUT = withSecurity(async (request: NextRequest) => {
  try {
    // Workspace access check — user must be admin of the workspace
    const auth = await requireWorkspaceAccess(request, { minimumRole: "admin" });
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "id is required" } },
        { status: 400 }
      );
    }

    // Verify the user has access to the specific workspace being updated
    if (id !== auth.workspaceId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Cannot update a workspace you don't belong to" } },
        { status: 403 }
      );
    }

    const service = getWorkspaceService();
    const workspace = await service.update(id, updates);

    if (!workspace) {
      return NextResponse.json(
        { error: { code: "UPDATE_FAILED", message: "Failed to update workspace" } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, workspace });
  } catch (error) {
    logger.error("Route handler error", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update workspace" } },
      { status: 500 }
    );
  }
});
