// Shopify OAuth Callback
// Exchanges authorization code for access token and stores store connection.
//
// Flow:
// 1. User clicks "Connect Shopify" → redirected to /api/shopify/install
// 2. User approves → Shopify redirects here with ?code=...&shop=...
// 3. We exchange code for access token → store in shopify_stores table

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database/supabase-server";
import { supabase } from "@/lib/database/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop");
  const code = searchParams.get("code");

  if (!shop || !code) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?tab=integrations&error=missing_params", request.url)
    );
  }

  try {
    // 1. Get current user from session
    const client = await createClient();
    if (!client) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?tab=integrations&error=no_supabase", request.url)
      );
    }

    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return NextResponse.redirect(
        new URL("/login?redirect=/dashboard/settings?tab=integrations", request.url)
      );
    }

    // 2. Exchange authorization code for access token
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error("[Shopify] Missing SHOPIFY_API_KEY or SHOPIFY_API_SECRET");
      return NextResponse.redirect(
        new URL("/dashboard/settings?tab=integrations&error=missing_config", request.url)
      );
    }

    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[Shopify] Token exchange failed:", errText);
      return NextResponse.redirect(
        new URL(`/dashboard/settings?tab=integrations&error=token_exchange_failed`, request.url)
      );
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const scope = tokenData.scope;

    // 3. Get shop info
    const shopRes = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    let storeName = shop;
    let storeEmail = "";
    let currency = "USD";
    let planName = "";

    if (shopRes.ok) {
      const shopData = await shopRes.json();
      storeName = shopData.shop?.name || shop;
      storeEmail = shopData.shop?.email || "";
      currency = shopData.shop?.currency || "USD";
      planName = shopData.shop?.plan_name || "";
    }

    // 4. Determine workspace_id
    // For now, use ws-default (same as auth system)
    const workspaceId = "ws-default";

    // 5. Upsert store connection
    const { error: upsertError } = await supabase
      .from("shopify_stores")
      .upsert(
        {
          workspace_id: workspaceId,
          shop_domain: shop,
          access_token: accessToken,
          scope,
          store_name: storeName,
          store_email: storeEmail,
          currency,
          plan_name: planName,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,shop_domain" }
      );

    if (upsertError) {
      console.error("[Shopify] Failed to store connection:", upsertError);
      return NextResponse.redirect(
        new URL("/dashboard/settings?tab=integrations&error=store_failed", request.url)
      );
    }

    // 6. Redirect to settings with success
    return NextResponse.redirect(
      new URL("/dashboard/settings?tab=integrations&shopify=connected", request.url)
    );
  } catch (error) {
    console.error("[Shopify] OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/settings?tab=integrations&error=unknown", request.url)
    );
  }
}
