// Shopify Install Route
// Redirects user to Shopify OAuth authorization page.
//
// Usage: GET /api/shopify/install?shop=my-store.myshopify.com

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";
import { createHmac } from "crypto";

/**
 * Sign workspace_id with HMAC to prevent OAuth state tampering.
 */
function signState(workspaceId: string): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.ENCRYPTION_KEY || "";
  const signature = createHmac("sha256", secret).update(workspaceId).digest("hex").slice(0, 16);
  return `${workspaceId}.${signature}`;
}

export const GET = withSecurity(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const shop = searchParams.get("shop");

  if (!shop) {
    return NextResponse.json(
      { error: "shop parameter is required" },
      { status: 400 }
    );
  }

  // Resolve workspace from auth
  const access = await requireWorkspaceAccess(request);
  if ("error" in access) return access.error;

  // Normalize shop domain
  const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;

  const apiKey = process.env.SHOPIFY_API_KEY;
  const scopes = process.env.SHOPIFY_SCOPES || "read_products,read_orders,read_content";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/shopify/callback`;

  if (!apiKey) {
    return NextResponse.json(
      { error: "SHOPIFY_API_KEY not configured" },
      { status: 500 }
    );
  }

  // Build Shopify OAuth URL — pass workspace_id as state for callback
  const authUrl = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", apiKey);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", signState(access.workspaceId));

  return NextResponse.redirect(authUrl.toString());
});
