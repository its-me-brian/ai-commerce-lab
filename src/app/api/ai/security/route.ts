import { NextRequest, NextResponse } from "next/server";
import { getSecurityAudit } from "@/lib/security/middleware";

// GET /api/ai/security
// Query security audit events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "recent";
    const count = parseInt(searchParams.get("count") || "50");

    const audit = getSecurityAudit();

    switch (action) {
      case "recent": {
        const entries = audit.getRecent(count);
        return NextResponse.json({ success: true, events: entries });
      }
      case "type": {
        const eventType = searchParams.get("eventType");
        if (!eventType) {
          return NextResponse.json(
            { success: false, error: "eventType param required" },
            { status: 400 }
          );
        }
        const entries = audit.getByType(eventType as "sanitization_applied" | "injection_detected" | "rate_limit_hit" | "validation_failed" | "size_limit_exceeded" | "unauthorized_access" | "suspicious_input");
        return NextResponse.json({ success: true, events: entries });
      }
      case "severity": {
        const severity = searchParams.get("severity") as "low" | "medium" | "high" | "critical";
        if (!severity) {
          return NextResponse.json(
            { success: false, error: "severity param required" },
            { status: 400 }
          );
        }
        const entries = audit.getBySeverity(severity);
        return NextResponse.json({ success: true, events: entries });
      }
      case "client": {
        const clientId = searchParams.get("clientId");
        if (!clientId) {
          return NextResponse.json(
            { success: false, error: "clientId param required" },
            { status: 400 }
          );
        }
        const entries = audit.getByClient(clientId);
        return NextResponse.json({ success: true, events: entries });
      }
      case "stats": {
        const stats = audit.getStats();
        return NextResponse.json({ success: true, stats });
      }
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
