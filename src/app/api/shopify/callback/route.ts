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
import { encrypt } from "@/lib/ai/encryption";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logging";

/**
 * Verify HMAC signature on OAuth state parameter.
 * Returns the workspace_id if valid, null if tampered.
 */
function verifyState(state: string): string | null {
  const dotIndex = state.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const workspaceId = state.slice(0, dotIndex);
  const receivedSig = state.slice(dotIndex + 1);

  const secret = process.env.OAUTH_STATE_SECRET || process.env.ENCRYPTION_KEY || "";
  const expectedSig = createHmac("sha256", secret).update(workspaceId).digest("hex").slice(0, 16);

  if (receivedSig.length !== expectedSig.length) return null;

  // Timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(receivedSig, "hex");
  const expectedBuffer = Buffer.from(expectedSig, "hex");

  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  return workspaceId;
}

// SSRF prevention: only allow valid Shopify myshopify.com domains
const SHOPIFY_SHOP_REGEX = /^[a-z0-9][a-z0-9\-]*\.myshopify\.com$/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop");
  const code = searchParams.get("code");

  if (!shop || !code) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?tab=integrations&error=missing_params", request.url)
    );
  }

  // CRITICAL: Validate shop domain to prevent SSRF
  if (!SHOPIFY_SHOP_REGEX.test(shop)) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?tab=integrations&error=invalid_shop", request.url)
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
      logger.error("Shopify missing API credentials");
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
      logger.error("Shopify token exchange failed", { status: tokenRes.status });
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

    // 4. Determine workspace_id from OAuth state (set by /api/shopify/install)
    const rawState = searchParams.get("state");
    if (!rawState) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?tab=integrations&error=missing_state", request.url)
      );
    }

    // CRITICAL: Verify HMAC signature to prevent state tampering
    const state = verifyState(rawState);
    if (!state) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?tab=integrations&error=invalid_state", request.url)
      );
    }

    // 4b. Validate that the authenticated user is a member of the workspace from state
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const serviceClient = createServiceClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: membership } = await serviceClient
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", state)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?tab=integrations&error=unauthorized", request.url)
      );
    }

    const workspaceId = state;

    // 5. Upsert store connection (encrypt access_token)
    const encryptedToken = encrypt(accessToken);
    const { error: upsertError } = await supabase
      .from("shopify_stores")
      .upsert(
        {
          workspace_id: workspaceId,
          shop_domain: shop,
          access_token: JSON.stringify(encryptedToken),
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
      logger.error("Failed to store Shopify connection", { shop, code: upsertError.code });
      return NextResponse.redirect(
        new URL("/dashboard/settings?tab=integrations&error=store_failed", request.url)
      );
    }

    // 6. Redirect to settings with success
    return NextResponse.redirect(
      new URL("/dashboard/settings?tab=integrations&shopify=connected", request.url)
    );
  } catch (error) {
    logger.error("Shopify OAuth callback error", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.redirect(
      new URL("/dashboard/settings?tab=integrations&error=unknown", request.url)
    );
  }
}
