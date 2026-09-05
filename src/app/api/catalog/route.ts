// Product Catalog API
// GET /api/catalog — List products (query: status, limit, offset)
// POST /api/catalog — Add product to catalog

import { NextRequest, NextResponse } from "next/server";
import { getCatalogService, type CatalogStatus } from "@/lib/catalog/service";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";

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
  } catch  {
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
    const catalog = getCatalogService();

    const product = await catalog.create({ ...body, workspace_id: auth.workspaceId });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Failed to create catalog product" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, product });
  } catch  {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
});
