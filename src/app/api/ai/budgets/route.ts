import { NextRequest, NextResponse } from "next/server";
import { getCostBudgetTracker } from "@/lib/ai/cost-budget";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { sanitizeBody } from "@/lib/security/sanitize";
import type { CostBudget, BudgetEntityType } from "@/lib/ai/cost-budget";

// GET /api/ai/budgets
// Get all budgets or status for an entity
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const auth = await requireWorkspaceAccess(request);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "list";
    const entityId = searchParams.get("entityId");
    const entityType = searchParams.get("entityType") as BudgetEntityType | null;

    const tracker = getCostBudgetTracker();

    switch (action) {
      case "list": {
        const budgets = entityId
          ? tracker.getBudgetsForEntity(entityId, entityType ?? undefined)
          : tracker.getAllBudgets();
        return NextResponse.json({ success: true, budgets });
      }
      case "status": {
        if (!entityId) {
          return NextResponse.json(
            { success: false, error: "entityId required for status" },
            { status: 400 }
          );
        }
        const statuses = tracker.getEntityStatus(entityId, entityType ?? undefined);
        return NextResponse.json({ success: true, statuses });
      }
      case "spending": {
        if (!entityId || !entityType) {
          return NextResponse.json(
            { success: false, error: "entityId and entityType required for spending" },
            { status: 400 }
          );
        }
        const window = searchParams.get("window") || "day";
        const spending = tracker.getSpending(entityId, entityType, window as "day" | "hour" | "total");
        return NextResponse.json({ success: true, spending });
      }
      case "alerts": {
        const alerts = entityId
          ? tracker.getAlertsForEntity(entityId)
          : tracker.getAlerts();
        return NextResponse.json({ success: true, alerts });
      }
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// POST /api/ai/budgets
// Create or update a budget
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await requireWorkspaceAccess(request);
    if ("error" in auth) return auth.error;

    const body = sanitizeBody(await request.json()) as Record<string, unknown>;
    const budget = body.budget as CostBudget | undefined;
    const action = body.action as string;

    const tracker = getCostBudgetTracker();

    if (action === "remove" && budget?.id) {
      await tracker.removeBudget(budget.id);
      return NextResponse.json({ success: true, message: `Budget ${budget.id} removed` });
    }

    if (!budget || !budget.id || !budget.entityId || !budget.maxDollars) {
      return NextResponse.json(
        { success: false, error: "budget.id, budget.entityId, and budget.maxDollars are required" },
        { status: 400 }
      );
    }

    // Ensure workspaceId from auth, not from client
    budget.workspaceId = auth.workspaceId;

    tracker.setBudget(budget);
    return NextResponse.json({ success: true, budget });
  } catch {
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
