import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceService } from "@/lib/workspaces/service";
import { requireAuth, requireWorkspaceAccess } from "@/lib/auth/api-auth";

// GET /api/workspaces
// Returns the current workspace (or default).
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const auth = await requireAuth(request);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || undefined;

    const service = getWorkspaceService();

    if (id) {
      const workspace = await service.get(id);
      if (!workspace) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Workspace not found" } },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, workspace });
    }

    // Return all workspaces
    const workspaces = await service.list();
    return NextResponse.json({ success: true, workspaces });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load workspaces" } },
      { status: 500 }
    );
  }
}

// POST /api/workspaces
// Create a new workspace.
export async function POST(request: NextRequest) {
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
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create workspace" } },
      { status: 500 }
    );
  }
}

// PUT /api/workspaces
// Update an existing workspace — requires admin role.
export async function PUT(request: NextRequest) {
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
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update workspace" } },
      { status: 500 }
    );
  }
}
