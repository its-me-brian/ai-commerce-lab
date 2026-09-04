// Shopify Product Sync
// Pulls products from Shopify and upserts them into product_catalog.

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { supabase } from "@/lib/database/supabase";
import { createShopifyClient } from "@/lib/integrations/shopify/client";
import { decrypt, type EncryptedData } from "@/lib/ai/encryption";

export async function POST(request: NextRequest) {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  try {
    // 1. Get store connection
    const { data: store, error: storeError } = await supabase
      .from("shopify_stores")
      .select("*")
      .eq("workspace_id", auth.workspaceId)
      .eq("status", "active")
      .single();

    if (storeError || !store) {
      return NextResponse.json(
        { success: false, error: "No active Shopify store connected" },
        { status: 404 }
      );
    }

    // 2. Create Shopify client (decrypt access token)
    const encryptedData: EncryptedData = JSON.parse(store.access_token);
    const accessToken = decrypt(encryptedData);
    const shopify = createShopifyClient({
      shopDomain: store.shop_domain,
      accessToken,
    });

    // 3. Fetch all products from Shopify
    const shopifyProducts = await shopify.fetchAllProducts("active");

    // 4. Upsert into product_catalog
    let upserted = 0;
    let skipped = 0;

    for (const product of shopifyProducts) {
      // Get first variant price
      const price = product.variants?.[0]?.price
        ? parseFloat(product.variants[0].price)
        : null;

      // Get first image
      const imageUrl = product.images?.[0]?.src || null;

      // Determine status based on product status
      const status = product.status === "active" ? "listed" : "discovered";

      const { error } = await supabase
        .from("product_catalog")
        .upsert(
          {
            workspace_id: auth.workspaceId,
            name: product.title,
            description: product.body_html || null,
            category: product.product_type || null,
            supplier_price: null, // Shopify doesn't have supplier price
            selling_price: price,
            currency: store.currency,
            image_url: imageUrl,
            source: "shopify",
            source_id: String(product.id),
            source_url: `https://${store.shop_domain}/admin/products/${product.id}`,
            status,
            tags: product.tags || [],
            updated_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,source_id" }
        );

      if (error) {
        console.error(`[Shopify] Failed to upsert product ${product.id}:`, error.message);
        skipped++;
      } else {
        upserted++;
      }
    }

    // 5. Update store sync timestamp
    await supabase
      .from("shopify_stores")
      .update({
        last_products_sync_at: new Date().toISOString(),
        products_count: upserted,
        updated_at: new Date().toISOString(),
      })
      .eq("id", store.id);

    return NextResponse.json({
      success: true,
      synced: upserted,
      skipped,
      total: shopifyProducts.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
