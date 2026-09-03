// Shopify Stores API
// List connected stores and disconnect.

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { supabase } from "@/lib/database/supabase";

// GET /api/shopify/stores — list connected stores
export async function GET(request: NextRequest) {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  const { data, error } = await supabase
    .from("shopify_stores")
    .select("id, shop_domain, store_name, store_email, currency, plan_name, status, products_count, orders_count, last_products_sync_at, last_orders_sync_at, created_at")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, stores: data || [] });
}

// DELETE /api/shopify/stores?id=xxx — disconnect store
export async function DELETE(request: NextRequest) {
  const auth = await requireWorkspaceAccess(request, { minimumRole: "admin" });
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("id");

  if (!storeId) {
    return NextResponse.json({ success: false, error: "Store ID required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("shopify_stores")
    .delete()
    .eq("id", storeId)
    .eq("workspace_id", auth.workspaceId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
