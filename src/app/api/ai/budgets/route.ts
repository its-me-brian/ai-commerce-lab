import { NextRequest, NextResponse } from "next/server";
import { getCostBudgetTracker } from "@/lib/ai/cost-budget";
import type { CostBudget, BudgetEntityType } from "@/lib/ai/cost-budget";

// GET /api/ai/budgets
// Get all budgets or status for an entity
export async function GET(request: NextRequest) {
  try {
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
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST /api/ai/budgets
// Create or update a budget
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { budget, action } = body as {
      budget?: CostBudget;
      action?: string;
    };

    const tracker = getCostBudgetTracker();

    if (action === "remove" && budget?.id) {
      tracker.removeBudget(budget.id);
      return NextResponse.json({ success: true, message: `Budget ${budget.id} removed` });
    }

    if (!budget || !budget.id || !budget.entityId || !budget.maxDollars) {
      return NextResponse.json(
        { success: false, error: "budget.id, budget.entityId, and budget.maxDollars are required" },
        { status: 400 }
      );
    }

    tracker.setBudget(budget);
    return NextResponse.json({ success: true, budget });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
