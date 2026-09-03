// Cost Budget System
// Enforces spending limits per-agent, per-workflow, and globally.
//
// This is a pre-flight + post-execution budget enforcer:
//   - BEFORE execution: checkBudget() → can we afford this?
//   - AFTER execution:  recordCost()  → deduct from budget
//   - Provides alerts at configurable thresholds (80%, 90%, 100%)
//   - Tracks per-agent, per-workflow, per-mini-AI, and global budgets
//
// This is NOT the same as the cost scoring in EvaluationEngine.
// EvaluationEngine judges cost EFFICIENCY after the fact.
// CostBudgetTracker PREVENTS execution when budgets are exhausted.
//
// Persistence: budgets and cost records are persisted to Supabase
// (cost_budgets, cost_records tables) for survival across restarts.

/**
 * Budget time window.
 */
export type BudgetWindow = "minute" | "hour" | "day" | "month" | "total";

/**
 * Entity type that can have a budget.
 */
export type BudgetEntityType = "agent" | "workflow" | "mini-ai" | "global";

/**
 * Budget configuration — defines spending limits.
 */
export interface CostBudget {
  /** Unique identifier */
  id: string;

  /** Entity this budget applies to */
  entityId: string;

  /** Entity type */
  entityType: BudgetEntityType;

  /** Maximum spending in dollars */
  maxDollars: number;

  /** Time window for the budget */
  window: BudgetWindow;

  /** Alert thresholds as fractions (e.g., [0.8, 0.9] = warn at 80% and 90%) */
  alertThresholds?: number[];

  /** Whether this budget is currently active */
  active: boolean;

  /** Optional description */
  description?: string;
}

/**
 * Budget alert — emitted when spending crosses a threshold.
 */
export interface BudgetAlert {
  /** Budget ID */
  budgetId: string;

  /** Entity this alert is about */
  entityId: string;

  /** Entity type */
  entityType: BudgetEntityType;

  /** Alert level */
  level: "warning" | "critical" | "exceeded";

  /** Current spending in dollars */
  currentSpending: number;

  /** Budget limit in dollars */
  budgetLimit: number;

  /** Spending as fraction of limit (0-1+) */
  utilizationPercent: number;

  /** Timestamp */
  timestamp: number;
}

/**
 * Cost record — a single spending entry.
 */
export interface CostRecord {
  /** Entity that incurred the cost */
  entityId: string;

  /** Entity type */
  entityType: BudgetEntityType;

  /** Cost in dollars */
  costDollars: number;

  /** Optional parent entity (e.g., mini-AI called by workflow) */
  parentEntityId?: string;

  /** Timestamp */
  timestamp: number;

  /** Optional provider name */
  provider?: string;

  /** Optional model name */
  model?: string;

  /** Optional input tokens */
  inputTokens?: number;

  /** Optional output tokens */
  outputTokens?: number;

  /** Optional task ID */
  taskId?: string;

  /** Optional run ID */
  runId?: string;

  /** Optional description of what incurred this cost */
  description?: string;
}

/**
 * Budget status — current spending vs limit.
 */
export interface BudgetStatus {
  /** Budget config */
  budget: CostBudget;

  /** Current spending within the window (dollars) */
  currentSpending: number;

  /** Remaining budget (dollars) */
  remainingDollars: number;

  /** Utilization fraction (0-1+) */
  utilizationPercent: number;

  /** Whether budget is exhausted */
  exhausted: boolean;

  /** Active alerts for this budget */
  alerts: BudgetAlert[];
}

/**
 * Default alert thresholds: 80% warning, 95% critical.
 */
const DEFAULT_ALERT_THRESHOLDS = [0.8, 0.95];

/**
 * Window duration in milliseconds.
 */
const WINDOW_MS: Record<BudgetWindow, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  month: 30 * 86_400_000,
  total: Infinity,
};

/**
 * Cost Budget Tracker — enforces spending limits.
 */
export class CostBudgetTracker {
  private budgets: Map<string, CostBudget> = new Map();
  private records: CostRecord[] = [];
  private alerts: BudgetAlert[] = [];
  private readonly maxRecords = 10_000;
  private readonly maxAlerts = 1_000;

  // ============================================
  // BUDGET MANAGEMENT
  // ============================================

  /**
   * Add or update a budget.
   */
  setBudget(budget: CostBudget): void {
    this.budgets.set(budget.id, budget);
    // Persist to Supabase (fire-and-forget)
    this.persistBudgetToSupabase(budget);
  }

  /**
   * Remove a budget.
   */
  async removeBudget(budgetId: string): Promise<void> {
    this.budgets.delete(budgetId);
    // Delete from Supabase (fire-and-forget)
    try {
      const { supabase } = await import("@/lib/database/supabase");
      await supabase.from("cost_budgets").delete().eq("id", budgetId);
    } catch (error) {
      console.error("[CostBudget] Failed to delete budget from Supabase:", error);
    }
  }

  /**
   * Get a budget by ID.
   */
  getBudget(budgetId: string): CostBudget | undefined {
    return this.budgets.get(budgetId);
  }

  /**
   * Get all budgets for an entity.
   */
  getBudgetsForEntity(entityId: string, entityType?: BudgetEntityType): CostBudget[] {
    return Array.from(this.budgets.values()).filter(
      (b) => b.entityId === entityId && (!entityType || b.entityType === entityType)
    );
  }

  /**
   * Get all active budgets.
   */
  getActiveBudgets(): CostBudget[] {
    return Array.from(this.budgets.values()).filter((b) => b.active);
  }

  /**
   * Get all budgets.
   */
  getAllBudgets(): CostBudget[] {
    return Array.from(this.budgets.values());
  }

  // ============================================
  // PRE-FLIGHT CHECKS
  // ============================================

  /**
   * Check if an entity can afford to spend estimatedCost dollars.
   * Returns the worst (most restrictive) budget status that would be violated.
   *
   * @returns BudgetStatus[] if all budgets are OK, or the violating budget status
   */
  checkBudget(
    entityId: string,
    entityType: BudgetEntityType,
    estimatedCostDollars: number
  ): { allowed: true; statuses: BudgetStatus[] } | { allowed: false; violatedBudget: BudgetStatus } {
    const budgets = this.getBudgetsForEntity(entityId, entityType).filter((b) => b.active);

    // Also check global budget
    const globalBudgets = this.getBudgetsForEntity("global", "global").filter((b) => b.active);
    const allBudgets = [...budgets, ...globalBudgets];

    if (allBudgets.length === 0) {
      return { allowed: true, statuses: [] };
    }

    const statuses: BudgetStatus[] = [];

    for (const budget of allBudgets) {
      const status = this.getBudgetStatus(budget);
      const wouldExceed = status.currentSpending + estimatedCostDollars > budget.maxDollars;

      if (wouldExceed) {
        return { allowed: false, violatedBudget: status };
      }

      statuses.push(status);
    }

    return { allowed: true, statuses };
  }

  /**
   * Convenience: throw if budget not allowed.
   * Use before execution to fail fast.
   */
  assertBudget(
    entityId: string,
    entityType: BudgetEntityType,
    estimatedCostDollars: number
  ): void {
    const result = this.checkBudget(entityId, entityType, estimatedCostDollars);
    if (!result.allowed) {
      const b = result.violatedBudget;
      throw new Error(
        `Budget exceeded for ${b.budget.entityType}:${b.budget.entityId}: ` +
        `${b.currentSpending.toFixed(4)}/${b.budget.maxDollars.toFixed(4)} ` +
        `(${(b.utilizationPercent * 100).toFixed(1)}% used)`
      );
    }
  }

  // ============================================
  // COST RECORDING
  // ============================================

  /**
   * Record a cost after execution.
   * Checks thresholds and emits alerts if needed.
   */
  recordCost(record: Omit<CostRecord, "timestamp">): BudgetAlert[] {
    const fullRecord: CostRecord = {
      ...record,
      timestamp: Date.now(),
    };

    this.records.push(fullRecord);

    // Trim history
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }

    // Persist to Supabase (fire-and-forget)
    this.persistCostRecordToSupabase(fullRecord);

    // Check alerts for all affected budgets
    const newAlerts = this.checkAlerts(record.entityId, record.entityType);

    // Also check global budget
    if (record.entityType !== "global") {
      const globalAlerts = this.checkAlerts("global", "global");
      newAlerts.push(...globalAlerts);
    }

    return newAlerts;
  }

  // ============================================
  // STATUS & QUERIES
  // ============================================

  /**
   * Get the status of a specific budget.
   */
  getBudgetStatus(budget: CostBudget): BudgetStatus {
    const spending = this.getSpending(budget.entityId, budget.entityType, budget.window);
    const utilization = budget.maxDollars > 0 ? spending / budget.maxDollars : 0;
    const activeAlerts = this.alerts.filter((a) => a.budgetId === budget.id);

    return {
      budget,
      currentSpending: spending,
      remainingDollars: Math.max(0, budget.maxDollars - spending),
      utilizationPercent: utilization,
      exhausted: spending >= budget.maxDollars,
      alerts: activeAlerts,
    };
  }

  /**
   * Get status for all budgets of an entity.
   */
  getEntityStatus(entityId: string, entityType?: BudgetEntityType): BudgetStatus[] {
    const budgets = this.getBudgetsForEntity(entityId, entityType).filter((b) => b.active);
    return budgets.map((b) => this.getBudgetStatus(b));
  }

  /**
   * Get spending for an entity within a time window.
   */
  getSpending(entityId: string, entityType: BudgetEntityType, window: BudgetWindow): number {
    const now = Date.now();
    const windowStart = window === "total" ? 0 : now - WINDOW_MS[window];

    return this.records
      .filter((r) => {
        const matchesTime = r.timestamp >= windowStart;

        if (entityType === "global" && entityId === "global") {
          // Global budget: count ALL spending across all entities
          return matchesTime;
        }

        const matchesEntity = r.entityId === entityId && r.entityType === entityType;
        return matchesEntity && matchesTime;
      })
      .reduce((sum, r) => sum + r.costDollars, 0);
  }

  /**
   * Get total spending across all entities.
   */
  getTotalSpending(window: BudgetWindow = "total"): number {
    const now = Date.now();
    const windowStart = window === "total" ? 0 : now - WINDOW_MS[window];

    return this.records
      .filter((r) => r.timestamp >= windowStart)
      .reduce((sum, r) => sum + r.costDollars, 0);
  }

  /**
   * Get recent cost records.
   */
  getRecentRecords(count: number = 50): CostRecord[] {
    return this.records.slice(-count);
  }

  /**
   * Get all active alerts.
   */
  getAlerts(): BudgetAlert[] {
    return [...this.alerts];
  }

  /**
   * Get recent alerts for an entity.
   */
  getAlertsForEntity(entityId: string): BudgetAlert[] {
    return this.alerts.filter((a) => a.entityId === entityId);
  }

  /**
   * Clear alerts for a specific budget.
   */
  clearAlerts(budgetId: string): void {
    this.alerts = this.alerts.filter((a) => a.budgetId !== budgetId);
  }

  /**
   * Clear all alerts.
   */
  clearAllAlerts(): void {
    this.alerts = [];
  }

  /**
   * Reset everything (budgets, records, alerts).
   */
  clear(): void {
    this.budgets.clear();
    this.records = [];
    this.alerts = [];
  }

  // ============================================
  // SUPABASE PERSISTENCE
  // ============================================

  /**
   * Persist a budget to Supabase cost_budgets table.
   * Fire-and-forget with error logging.
   */
  async persistBudgetToSupabase(budget: CostBudget): Promise<void> {
    try {
      const { supabase } = await import("@/lib/database/supabase");

      await supabase.from("cost_budgets").upsert(
        {
          id: budget.id,
          entity_id: budget.entityId,
          entity_type: budget.entityType,
          max_dollars: budget.maxDollars,
          time_window: budget.window,
          description: budget.description ?? null,
          alert_thresholds: budget.alertThresholds ?? [0.8, 0.95],
          active: budget.active,
        },
        { onConflict: "id" }
      );
    } catch (error) {
      console.error("[CostBudget] Failed to persist budget to Supabase:", error);
    }
  }

  /**
   * Persist a cost record to Supabase cost_records table.
   * Fire-and-forget with error logging.
   */
  async persistCostRecordToSupabase(record: CostRecord): Promise<void> {
    try {
      const { supabase } = await import("@/lib/database/supabase");

      await supabase.from("cost_records").insert({
        entity_id: record.entityId,
        entity_type: record.entityType,
        cost_dollars: record.costDollars,
        provider: record.provider ?? null,
        model: record.model ?? null,
        input_tokens: record.inputTokens ?? null,
        output_tokens: record.outputTokens ?? null,
        task_id: record.taskId ?? null,
        run_id: record.runId ?? null,
      });
    } catch (error) {
      console.error("[CostBudget] Failed to persist cost record to Supabase:", error);
    }
  }

  /**
   * Load budgets from Supabase (for cold-start recovery).
   */
  async loadBudgetsFromSupabase(): Promise<void> {
    try {
      const { supabase } = await import("@/lib/database/supabase");

      const { data, error } = await supabase
        .from("cost_budgets")
        .select("*")
        .eq("active", true);

      if (error) throw error;

      for (const row of data ?? []) {
        this.budgets.set(row.id, {
          id: row.id,
          entityId: row.entity_id,
          entityType: row.entity_type as BudgetEntityType,
          maxDollars: row.max_dollars,
          window: row.time_window as BudgetWindow,
          alertThresholds: row.alert_thresholds ?? undefined,
          active: row.active,
          description: row.description ?? undefined,
        });
      }

      console.log(`[CostBudget] Loaded ${data?.length ?? 0} budgets from Supabase`);
    } catch (error) {
      console.error("[CostBudget] Failed to load budgets from Supabase:", error);
    }
  }

  // ============================================
  // INTERNAL
  // ============================================

  private checkAlerts(entityId: string, entityType: BudgetEntityType): BudgetAlert[] {
    const budgets = this.getBudgetsForEntity(entityId, entityType).filter((b) => b.active);
    const newAlerts: BudgetAlert[] = [];

    for (const budget of budgets) {
      const status = this.getBudgetStatus(budget);
      const thresholds = budget.alertThresholds ?? DEFAULT_ALERT_THRESHOLDS;

      // Check each threshold level
      for (const threshold of thresholds) {
        const wouldBeLevel: BudgetAlert["level"] =
          status.utilizationPercent >= 1 ? "exceeded" : threshold >= 0.95 ? "critical" : "warning";

        // Don't fire duplicate alerts for the same level
        const alreadyFired = this.alerts.some(
          (a) => a.budgetId === budget.id && a.level === wouldBeLevel
        );

        if (!alreadyFired && status.utilizationPercent >= threshold) {
          const alert: BudgetAlert = {
            budgetId: budget.id,
            entityId: budget.entityId,
            entityType: budget.entityType,
            level: status.utilizationPercent >= 1 ? "exceeded" : threshold >= 0.95 ? "critical" : "warning",
            currentSpending: status.currentSpending,
            budgetLimit: budget.maxDollars,
            utilizationPercent: status.utilizationPercent,
            timestamp: Date.now(),
          };

          newAlerts.push(alert);
          this.alerts.push(alert);

          // Trim alerts
          if (this.alerts.length > this.maxAlerts) {
            this.alerts = this.alerts.slice(-this.maxAlerts);
          }
        }
      }
    }

    return newAlerts;
  }
}

// ============================================
// SINGLETON
// ============================================

let trackerInstance: CostBudgetTracker | null = null;
let loadedFromSupabase = false;

export function getCostBudgetTracker(): CostBudgetTracker {
  if (!trackerInstance) {
    trackerInstance = new CostBudgetTracker();
    // Load budgets from Supabase on cold start (fire-and-forget)
    if (!loadedFromSupabase) {
      loadedFromSupabase = true;
      trackerInstance.loadBudgetsFromSupabase();
    }
  }
  return trackerInstance;
}

export function resetCostBudgetTracker(): void {
  trackerInstance = null;
}

// ============================================
// CONVENIENCE HELPERS
// ============================================

/**
 * Create a standard per-agent budget (day window).
 */
export function createAgentBudget(
  agentId: string,
  maxDollarsPerDay: number,
  options?: { description?: string; alertThresholds?: number[] }
): CostBudget {
  return {
    id: `agent:${agentId}:day`,
    entityId: agentId,
    entityType: "agent",
    maxDollars: maxDollarsPerDay,
    window: "day",
    alertThresholds: options?.alertThresholds,
    active: true,
    description: options?.description ?? `Daily budget for agent ${agentId}: $${maxDollarsPerDay}`,
  };
}

/**
 * Create a standard per-workflow budget.
 */
export function createWorkflowBudget(
  workflowId: string,
  maxDollarsPerRun: number,
  options?: { description?: string; alertThresholds?: number[] }
): CostBudget {
  return {
    id: `workflow:${workflowId}:total`,
    entityId: workflowId,
    entityType: "workflow",
    maxDollars: maxDollarsPerRun,
    window: "total",
    alertThresholds: options?.alertThresholds,
    active: true,
    description: options?.description ?? `Per-run budget for workflow ${workflowId}: $${maxDollarsPerRun}`,
  };
}

/**
 * Create a global daily budget.
 */
export function createGlobalDailyBudget(
  maxDollarsPerDay: number,
  options?: { description?: string; alertThresholds?: number[] }
): CostBudget {
  return {
    id: "global:global:day",
    entityId: "global",
    entityType: "global",
    maxDollars: maxDollarsPerDay,
    window: "day",
    alertThresholds: options?.alertThresholds,
    active: true,
    description: options?.description ?? `Global daily budget: $${maxDollarsPerDay}`,
  };
}
