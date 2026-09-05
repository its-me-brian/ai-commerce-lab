import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/supabase";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";

// GET /api/ai/models
// Lists all AI models grouped by provider
export const GET = withSecurity(async (request: NextRequest) => {
  try {
    const auth = await requireWorkspaceAccess(request);
    if ("error" in auth) return auth.error;

    const { data, error } = await supabase
      .from("ai_models")
      .select("*")
      .order("name");

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, models: data });
  } catch  {
    return NextResponse.json(
      { success: false, error: "Failed to load models" },
      { status: 500 }
    );
  }
});

// PATCH /api/ai/models
// DISABLED: ai_models is a global table without workspace isolation
 
export const PATCH = withSecurity(async (_request: NextRequest) => {
  return NextResponse.json(
    { success: false, error: "Model enable/disable not supported yet" },
    { status: 405 }
  );
});
