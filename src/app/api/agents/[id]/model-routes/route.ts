import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireAuth } from "@/lib/auth/api-auth";

// GET /api/agents/[id]/model-routes
// Get model routes (pool) for an agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;

  const { data, error } = await supabase
    .from("agent_model_routes")
    .select("*, ai_models!inner(name, model_id, provider_id, context_window, input_price, output_price, capabilities, ai_providers(name, slug))")
    .eq("agent_id", id)
    .order("priority", { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, routes: data });
}

// POST /api/agents/[id]/model-routes
// Add a model route for an agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const { modelId, priority, policy } = body as {
    modelId?: string;
    priority?: number;
    policy?: string;
  };

  if (!modelId) {
    return NextResponse.json(
      { success: false, error: "modelId is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("agent_model_routes")
    .insert({
      agent_id: id,
      model_id: modelId,
      priority: priority ?? 1,
      policy: policy ?? "preferred",
      enabled: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, route: data });
}

// PATCH /api/agents/[id]/model-routes
// Update a model route (priority, policy, enabled)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const { routeId, priority, policy, enabled } = body as {
    routeId?: string;
    priority?: number;
    policy?: string;
    enabled?: boolean;
  };

  if (!routeId) {
    return NextResponse.json(
      { success: false, error: "routeId is required" },
      { status: 400 }
    );
  }

  // Verify the route belongs to this agent
  const { data: existing } = await supabase
    .from("agent_model_routes")
    .select("agent_id")
    .eq("id", routeId)
    .single();

  if (!existing || existing.agent_id !== id) {
    return NextResponse.json(
      { success: false, error: "Route not found for this agent" },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (priority !== undefined) updates.priority = priority;
  if (policy !== undefined) updates.policy = policy;
  if (enabled !== undefined) updates.enabled = enabled;

  const { data, error } = await supabase
    .from("agent_model_routes")
    .update(updates)
    .eq("id", routeId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, route: data });
}

// DELETE /api/agents/[id]/model-routes
// Remove a model route
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const routeId = searchParams.get("routeId");

  if (!routeId) {
    return NextResponse.json(
      { success: false, error: "routeId query param is required" },
      { status: 400 }
    );
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from("agent_model_routes")
    .select("agent_id")
    .eq("id", routeId)
    .single();

  if (!existing || existing.agent_id !== id) {
    return NextResponse.json(
      { success: false, error: "Route not found for this agent" },
      { status: 404 }
    );
  }

  const { error } = await supabase
    .from("agent_model_routes")
    .delete()
    .eq("id", routeId);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
