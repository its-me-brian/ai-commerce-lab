// Settings Credentials API
// PHASE 2: Secure credential management via Vault.
// Never returns raw API keys to the client.

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess, requirePermission } from "@/lib/auth/api-auth";
import { getCredentialManager } from "@/lib/ai/credential-manager";
import { withSecurity } from "@/lib/security/api-middleware";

/**
 * GET /api/settings/credentials
 * List all credentials for the workspace (safe — no keys exposed).
 */
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const access = await requireWorkspaceAccess(request);
    if ("error" in access) return access.error;

    const vault = getCredentialManager();
    const credentials = await vault.listAll();

    return NextResponse.json({
      success: true,
      credentials,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/settings/credentials
 * Store a new credential (encrypted).
 * Body: { provider_id, name, api_key, environment? }
 */
export const POST = withSecurity(async (request: NextRequest) => {
  try {
    const access = await requireWorkspaceAccess(request, { minimumRole: "admin" });
    if ("error" in access) return access.error;

    const perm = requirePermission(access.role, "credentials.write");
    if ("error" in perm) return perm.error;

    const body = await request.json();
    const { provider_id, name, api_key, environment } = body;

    // Validate required fields
    if (!provider_id || !name || !api_key) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: provider_id, name, api_key",
        },
        { status: 400 }
      );
    }

    // Validate API key format (basic check)
    if (typeof api_key !== "string" || api_key.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: "API key must be a string with at least 8 characters",
        },
        { status: 400 }
      );
    }

    const vault = getCredentialManager();
    const credential = await vault.store({
      provider_id,
      name,
      api_key,
      environment: environment || "production",
      created_by: access.user.id,
    });

    if (!credential) {
      return NextResponse.json(
        { success: false, error: "Failed to store credential" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      credential,
      message: "Credential stored securely. The API key is encrypted and will not be shown again.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/settings/credentials?id=xxx
 * Delete a credential permanently.
 */
export const DELETE = withSecurity(async (request: NextRequest) => {
  try {
    const access = await requireWorkspaceAccess(request, { minimumRole: "admin" });
    if ("error" in access) return access.error;

    const perm = requirePermission(access.role, "credentials.delete");
    if ("error" in perm) return perm.error;

    const url = new URL(request.url);
    const credentialId = url.searchParams.get("id");

    if (!credentialId) {
      return NextResponse.json(
        { success: false, error: "Missing credential id" },
        { status: 400 }
      );
    }

    const vault = getCredentialManager();
    const deleted = await vault.delete(credentialId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Failed to delete credential" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Credential deleted permanently",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});
