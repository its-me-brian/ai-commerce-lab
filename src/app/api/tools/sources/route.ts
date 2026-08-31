import { NextResponse } from "next/server";
import { getAvailableSources } from "@/lib/tools/search-products";

// GET /api/tools/sources
// Returns available product search sources for the Dashboard.
export async function GET() {
  const sources = getAvailableSources();
  return NextResponse.json({ sources });
}
