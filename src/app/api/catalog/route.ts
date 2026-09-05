// Product Catalog API
// GET /api/catalog — List products (query: status, limit, offset)
// POST /api/catalog — Add product to catalog

import { NextRequest, NextResponse } from "next/server";
import { getCatalogService, type CatalogStatus } from "@/lib/catalog/service";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";
import { logger } from "@/lib/logging";

export const GET = withSecurity(async (request: NextRequest) => {
  try {
    // Auth + workspace check
    const auth = await requireWorkspaceAccess(request);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as CatalogStatus | null;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const search = searchParams.get("search");

    const catalog = getCatalogService();

    let products;
    if (search) {
      products = await catalog.search(search, { workspaceId: auth.workspaceId });
    } else {
      products = await catalog.list({ status: status || undefined, limit, offset, workspaceId: auth.workspaceId });
    }

    const counts = await catalog.getCountsByStatus(auth.workspaceId);

    return NextResponse.json({
      success: true,
      products,
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    logger.error("Route handler error", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
});

export const POST = withSecurity(async (request: NextRequest) => {
  try {
    // Auth + workspace check
    const auth = await requireWorkspaceAccess(request);
    if ("error" in auth) return auth.error;

    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: "name is required" },
        { status: 400 }
      );
    }

    // CRITICAL: Field allowlist to prevent mass assignment
    const allowedFields = [
      "name", "description", "category", "tags", "image_url", "source_url",
      "supplier_price", "selling_price", "source", "source_id",
      "store_content", "seo", "marketing_content", "finance_analysis",
      "overall_score", "risk_level", "status",
    ];
    const sanitizedBody: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        sanitizedBody[field] = body[field];
      }
    }

    const catalog = getCatalogService();
    const product = await catalog.create({ ...sanitizedBody, workspace_id: auth.workspaceId } as Parameters<typeof catalog.create>[0]);

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Failed to create catalog product" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    logger.error("Route handler error", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
});
