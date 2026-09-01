import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";

// GET /api/ai/models
// Lists all AI models grouped by provider
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("ai_models")
      .select("*")
      .order("name");

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, models: data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/ai/models
// Enable/disable a model
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, enabled } = body as { id?: string; enabled?: boolean };

    if (!id || typeof enabled !== "boolean") {
      return NextResponse.json(
        { success: false, error: "id and enabled (boolean) are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("ai_models")
      .update({ enabled })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, model: data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
