// Health Check API
// Minimal public endpoint — returns only status and timestamp.
// No internal details exposed (providers, models, agents, errors).

import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
}
