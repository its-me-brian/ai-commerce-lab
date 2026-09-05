// Product Catalog — Individual Product API
// GET /api/catalog/[id] — Get product details
// PATCH /api/catalog/[id] — Update product (status, content, etc.)
// DELETE /api/catalog/[id] — Remove from catalog

import { NextRequest, NextResponse } from "next/server";
import { getCatalogService } from "@/lib/catalog/service";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurityAndParams } from "@/lib/security/api-middleware";

export const GET = withSecurityAndParams<{ id: string }>(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const catalog = getCatalogService();
    const product = await catalog.getById(id, auth.workspaceId);

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
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

export const PATCH = withSecurityAndParams<{ id: string }>(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();

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
    const product = await catalog.update(id, sanitizedBody, auth.workspaceId);

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Failed to update product" },
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

export const DELETE = withSecurityAndParams<{ id: string }>(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const catalog = getCatalogService();
    const deleted = await catalog.delete(id, auth.workspaceId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Failed to delete product" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch  {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
});
