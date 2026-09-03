// Settings — Agent Model Routes API
// CRUD for agent→model routing (priority, cheapest, fastest).
// Uses session-scoped Supabase client for RLS enforcement.

import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess, requirePermission } from "@/lib/auth/api-auth";
import {
  AgentModelRoutes,
  type RouteCreateInput,
  type RouteUpdateInput,
} from "@/lib/ai/agent-model-routes";
import { withSecurity } from "@/lib/security/api-middleware";

const routes = new AgentModelRoutes();

/**
 * GET /api/settings/routes?agent_id=xxx
 * List routes for an agent, or all routes if no agent_id.
 */
export const GET = withSecurity(async (req: NextRequest) => {
  const auth = await requireWorkspaceAccess(req);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");

  const data = agentId
    ? await routes.listByAgent(agentId)
    : await routes.list();

  return NextResponse.json({ routes: data });
});

/**
 * POST /api/settings/routes
 * Create a new route.
 */
export const POST = withSecurity(async (req: NextRequest) => {
  const auth = await requireWorkspaceAccess(req);
  if ("error" in auth) return auth.error;

  const perm = requirePermission(auth.role, "catalog.publish");
  if ("error" in perm) return perm.error;

  const body = await req.json();
  const input: RouteCreateInput = {
    agent_id: body.agent_id,
    model_id: body.model_id,
    priority: body.priority,
    policy: body.policy,
    enabled: body.enabled,
  };

  const route = await routes.create(input);
  if (!route) {
    return NextResponse.json({ error: "Failed to create route" }, { status: 500 });
  }

  return NextResponse.json({ route }, { status: 201 });
});

/**
 * PATCH /api/settings/routes?id=xxx
 * Update a route.
 */
export const PATCH = withSecurity(async (req: NextRequest) => {
  const auth = await requireWorkspaceAccess(req);
  if ("error" in auth) return auth.error;

  const perm = requirePermission(auth.role, "catalog.publish");
  if ("error" in perm) return perm.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing route id" }, { status: 400 });
  }

  const body = await req.json();
  const input: RouteUpdateInput = {
    priority: body.priority,
    policy: body.policy,
    enabled: body.enabled,
  };

  const route = await routes.update(id, input);
  if (!route) {
    return NextResponse.json({ error: "Route not found or update failed" }, { status: 404 });
  }

  return NextResponse.json({ route });
});

/**
 * DELETE /api/settings/routes?id=xxx
 * Delete a route.
 */
export const DELETE = withSecurity(async (req: NextRequest) => {
  const auth = await requireWorkspaceAccess(req);
  if ("error" in auth) return auth.error;

  const perm = requirePermission(auth.role, "catalog.publish");
  if ("error" in perm) return perm.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing route id" }, { status: 400 });
  }

  const deleted = await routes.delete(id);
  if (!deleted) {
    return NextResponse.json({ error: "Route not found or delete failed" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});
