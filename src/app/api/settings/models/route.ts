// Settings — Models API
// CRUD for AI models. Requires workspace admin/owner role.
// Uses session-scoped Supabase client for RLS enforcement.

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess, requirePermission } from "@/lib/auth/api-auth";
import { ModelRegistry, type ModelCreateInput, type ModelUpdateInput } from "@/lib/ai/model-registry";
import { withSecurity } from "@/lib/security/api-middleware";

const registry = new ModelRegistry();

/**
 * GET /api/settings/models
 * List all models for the workspace.
 */
export const GET = withSecurity(async (req: NextRequest) => {
  const auth = await requireWorkspaceAccess(req);
  if ("error" in auth) return auth.error;

  const models = await registry.list();
  return NextResponse.json({ models });
});

/**
 * POST /api/settings/models
 * Create a new model. Requires catalog.publish permission.
 */
export const POST = withSecurity(async (req: NextRequest) => {
  const auth = await requireWorkspaceAccess(req);
  if ("error" in auth) return auth.error;

  const perm = requirePermission(auth.role, "catalog.publish");
  if ("error" in perm) return perm.error;

  const body = await req.json();
  const input: ModelCreateInput = {
    id: body.id,
    provider_id: body.provider_id,
    name: body.name,
    model_id: body.model_id,
    enabled: body.enabled,
    context_window: body.context_window,
    input_price: body.input_price,
    output_price: body.output_price,
    capabilities: body.capabilities,
  };

  const model = await registry.create(input);
  if (!model) {
    return NextResponse.json({ error: "Failed to create model" }, { status: 500 });
  }

  return NextResponse.json({ model }, { status: 201 });
});

/**
 * PATCH /api/settings/models?id=xxx
 * Update a model.
 */
export const PATCH = withSecurity(async (req: NextRequest) => {
  const auth = await requireWorkspaceAccess(req);
  if ("error" in auth) return auth.error;

  const perm = requirePermission(auth.role, "catalog.publish");
  if ("error" in perm) return perm.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing model id" }, { status: 400 });
  }

  const body = await req.json();
  const input: ModelUpdateInput = {
    name: body.name,
    enabled: body.enabled,
    context_window: body.context_window,
    input_price: body.input_price,
    output_price: body.output_price,
    capabilities: body.capabilities,
  };

  const model = await registry.update(id, input);
  if (!model) {
    return NextResponse.json({ error: "Model not found or update failed" }, { status: 404 });
  }

  return NextResponse.json({ model });
});

/**
 * DELETE /api/settings/models?id=xxx
 * Delete a model.
 */
export const DELETE = withSecurity(async (req: NextRequest) => {
  const auth = await requireWorkspaceAccess(req);
  if ("error" in auth) return auth.error;

  const perm = requirePermission(auth.role, "catalog.publish");
  if ("error" in perm) return perm.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing model id" }, { status: 400 });
  }

  const deleted = await registry.delete(id);
  if (!deleted) {
    return NextResponse.json({ error: "Model not found or delete failed" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});
