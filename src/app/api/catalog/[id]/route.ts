// Product Catalog — Individual Product API
// GET /api/catalog/[id] — Get product details
// PATCH /api/catalog/[id] — Update product (status, content, etc.)
// DELETE /api/catalog/[id] — Remove from catalog

import { NextRequest, NextResponse } from "next/server";
import { getCatalogService } from "@/lib/catalog/service";
import { requireAuth } from "@/lib/auth/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const catalog = getCatalogService();
    const product = await catalog.getById(id);

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const catalog = getCatalogService();

    const product = await catalog.update(id, body);

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Failed to update product" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const catalog = getCatalogService();
    const deleted = await catalog.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Failed to delete product" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
