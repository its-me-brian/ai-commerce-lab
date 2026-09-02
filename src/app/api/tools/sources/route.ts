import { NextRequest, NextResponse } from "next/server";
import { getAvailableSources } from "@/lib/tools/search-products";
import { requireAuth } from "@/lib/auth/api-auth";

// GET /api/tools/sources
// Returns available product search sources for the Dashboard.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth.error;

  const sources = getAvailableSources();
  return NextResponse.json({ sources });
}
