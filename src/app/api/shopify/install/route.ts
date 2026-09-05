// Shopify Install Route
// Redirects user to Shopify OAuth authorization page.
//
// Usage: GET /api/shopify/install?shop=my-store.myshopify.com
//
// FASE 5: State now includes expiration (10 min), nonce (single-use), and user binding.

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";
import { createHmac, randomBytes } from "crypto";

/**
 * Sign OAuth state with HMAC: workspaceId.timestamp.nonce.userId.signature
 * Format: {workspaceId}.{timestamp}.{nonce}.{userId}.{hmac}
 */
function signState(workspaceId: string, userId: string): string {
  const timestamp = Date.now();
  const nonce = randomBytes(16).toString("hex");
  const payload = `${workspaceId}.${timestamp}.${nonce}.${userId}`;

  // CRITICAL: Fail closed — never default to empty string for cryptographic secrets
  const secret = process.env.OAUTH_STATE_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("OAuth state signing not configured: set OAUTH_STATE_SECRET or ENCRYPTION_KEY");
  }
  const signature = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);

  return `${payload}.${signature}`;
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

  // Build Shopify OAuth URL — pass workspace_id + timestamp + nonce + userId as state
  const authUrl = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", apiKey);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", signState(access.workspaceId, access.user.id));

  return NextResponse.redirect(authUrl.toString());
});
