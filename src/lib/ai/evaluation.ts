// Evaluation System
// Quality scoring and performance tracking for mini-IAs and workflows.
//
// This is NOT the same as the Critic mini-AI (which evaluates individual outputs).
// This is a meta-evaluation system that:
//   - Tracks execution metrics (duration, cost, success rate)
//   - Computes quality scores from multiple signals
//   - Provides feedback loops for iterative improvement
//   - Aggregates scores across workflow execution

/**
 * Evaluation signal — a single quality indicator.
 */
export interface EvaluationSignal {
  /** Signal name (e.g., "output_completeness", "execution_time") */
  name: string;

  /** Signal value (0-1, where 1 is best) */
  score: number;

  /** Weight for aggregation (default: 1) */
  weight?: number;

  /** Human-readable explanation */
  explanation?: string;

  /** Source of this signal (which mini-AI or component produced it) */
  source: string;
}

/**
 * Evaluation result for a single execution.
 */
export interface ExecutionEvaluation {
  /** Overall quality score (0-1) */
  overallScore: number;

  /** Individual evaluation signals */
  signals: EvaluationSignal[];

  /** Execution metrics */
  metrics: {
    /** Duration in ms */
    durationMs: number;

    /** Cost in dollars */
    costDollars: number;

    /** Whether execution was successful */
    success: boolean;

    /** Number of retries */
    retries: number;

    /** Token usage */
    tokens?: {
      input: number;
      output: number;
    };
  };

  /** Free-form feedback */
  feedback?: string;

  /** Whether this evaluation passed quality threshold */
  passed: boolean;

  /** Timestamp */
  timestamp: number;

  /** Workspace ID for multi-tenant isolation */
  workspaceId?: string;
}

/**
 * Aggregated evaluation across multiple executions.
 */
export interface AggregatedEvaluation {
  /** Total executions evaluated */
  totalExecutions: number;

  /** Average overall score */
  averageScore: number;

  /** Score distribution (histogram) */
  scoreDistribution: {
    excellent: number; // 0.8-1.0
    good: number;      // 0.6-0.8
    fair: number;      // 0.4-0.6
    poor: number;      // 0.0-0.4
  };

  /** Average metrics */
  avgMetrics: {
    durationMs: number;
    costDollars: number;
    successRate: number;
    retryRate: number;
  };

  /** Per-signal averages */
  signalAverages: Record<string, number>;

  /** Trend (improving, stable, degrading) */
  trend: "improving" | "stable" | "degrading";
}

/**
 * Quality threshold configuration.
 */
export interface QualityThreshold {
  /** Minimum overall score to pass */
  minScore: number;

  /** Minimum score per signal (signal name → min score) */
  signalThresholds?: Record<string, number>;

  /** Maximum allowed duration in ms */
  maxDurationMs?: number;

  /** Maximum allowed cost in dollars */
  maxCostDollars?: number;
}

/**
 * Default quality thresholds by complexity.
 */
export const DEFAULT_THRESHOLDS: Record<string, QualityThreshold> = {
  trivial: { minScore: 0.3 },
  simple: { minScore: 0.5 },
  moderate: { minScore: 0.6 },
  complex: { minScore: 0.7 },
};

/**
 * Evaluation Engine — computes and tracks quality scores.
 * Persistence: Evaluations are persisted to Supabase (execution_evaluations table)
 * for survival across restarts. In-memory array is kept as read cache.
 */
export class EvaluationEngine {
  private evaluations: ExecutionEvaluation[] = [];
  private readonly maxHistory = 1000;

  /**
   * Evaluate a single mini-AI execution.
   *
   * @param input - The input provided to the mini-AI
   * @param output - The output produced
   * @param metrics - Execution metrics
   * @param threshold - Quality threshold (optional)
   * @returns Evaluation result
   */
  evaluateMiniAI(
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    metrics: {
      durationMs: number;
      costDollars: number;
      success: boolean;
      retries: number;
      tokens?: { input: number; output: number };
    },
    threshold?: QualityThreshold,
    workspaceId?: string
  ): ExecutionEvaluation {
    const signals: EvaluationSignal[] = [];

    // Signal 1: Output completeness
    const completeness = this.evaluateCompleteness(output);
    signals.push({
      name: "output_completeness",
      score: completeness,
      weight: 2,
      explanation: completeness > 0.7 ? "Output is comprehensive" : "Output may be incomplete",
      source: "evaluation-engine",
    });

    // Signal 2: Execution speed (relative to expected)
    const speedScore = this.evaluateSpeed(metrics.durationMs);
    signals.push({
      name: "execution_speed",
      score: speedScore,
      weight: 1,
      explanation: speedScore > 0.7 ? "Execution was fast" : "Execution was slow",
      source: "evaluation-engine",
    });

    // Signal 3: Cost efficiency
    const costScore = this.evaluateCost(metrics.costDollars);
    signals.push({
      name: "cost_efficiency",
      score: costScore,
      weight: 1,
      explanation: costScore > 0.7 ? "Cost was reasonable" : "Cost was high",
      source: "evaluation-engine",
    });

    // Signal 4: Success (binary)
    signals.push({
      name: "success",
      score: metrics.success ? 1 : 0,
      weight: 3,
      explanation: metrics.success ? "Execution succeeded" : "Execution failed",
      source: "evaluation-engine",
    });

    // Signal 5: No retries needed
    const retryScore = metrics.retries === 0 ? 1 : Math.max(0, 1 - metrics.retries * 0.3);
    signals.push({
      name: "retry_free",
      score: retryScore,
      weight: 1,
      explanation: metrics.retries === 0 ? "No retries needed" : `${metrics.retries} retries needed`,
      source: "evaluation-engine",
    });

    // Compute weighted average
    const overallScore = this.computeWeightedScore(signals);

    // Check threshold
    const passed = threshold
      ? this.checkThreshold(overallScore, signals, metrics, threshold)
      : overallScore >= 0.5;

    const evaluation: ExecutionEvaluation = {
      overallScore,
      signals,
      metrics: {
        durationMs: metrics.durationMs,
        costDollars: metrics.costDollars,
        success: metrics.success,
        retries: metrics.retries,
        tokens: metrics.tokens,
      },
      passed,
      timestamp: Date.now(),
      workspaceId,
    };

    this.recordEvaluation(evaluation);
    return evaluation;
  }

  /**
   * Evaluate a workflow execution (aggregate across all nodes).
   */
  evaluateWorkflow(
    nodeEvaluations: ExecutionEvaluation[],
    totalDurationMs: number,
    totalCostDollars: number,
    workspaceId?: string
  ): ExecutionEvaluation {
    if (nodeEvaluations.length === 0) {
      return {
        overallScore: 0,
        signals: [],
        metrics: { durationMs: totalDurationMs, costDollars: totalCostDollars, success: false, retries: 0 },
        passed: false,
        timestamp: Date.now(),
      };
    }

    const signals: EvaluationSignal[] = [];

    // Signal 1: Average node score
    const avgNodeScore = nodeEvaluations.reduce((sum, e) => sum + e.overallScore, 0) / nodeEvaluations.length;
    signals.push({
      name: "avg_node_score",
      score: avgNodeScore,
      weight: 2,
      explanation: `Average score across ${nodeEvaluations.length} nodes`,
      source: "evaluation-engine",
    });

    // Signal 2: All nodes passed
    const allPassed = nodeEvaluations.every((e) => e.passed);
    signals.push({
      name: "all_nodes_passed",
      score: allPassed ? 1 : 0,
      weight: 3,
      explanation: allPassed ? "All nodes passed quality checks" : "Some nodes failed quality checks",
      source: "evaluation-engine",
    });

    // Signal 3: No failures
    const failureCount = nodeEvaluations.filter((e) => !e.metrics.success).length;
    const failureScore = failureCount === 0 ? 1 : Math.max(0, 1 - failureCount / nodeEvaluations.length);
    signals.push({
      name: "no_failures",
      score: failureScore,
      weight: 2,
      explanation: failureCount === 0 ? "No node failures" : `${failureCount} node(s) failed`,
      source: "evaluation-engine",
    });

    // Signal 4: Workflow duration
    const durationScore = this.evaluateSpeed(totalDurationMs);
    signals.push({
      name: "workflow_duration",
      score: durationScore,
      weight: 1,
      explanation: `Total duration: ${totalDurationMs}ms`,
      source: "evaluation-engine",
    });

    const overallScore = this.computeWeightedScore(signals);
    const allSuccess = nodeEvaluations.every((e) => e.metrics.success);

    return {
      overallScore,
      signals,
      metrics: {
        durationMs: totalDurationMs,
        costDollars: totalCostDollars,
        success: allSuccess,
        retries: nodeEvaluations.reduce((sum, e) => sum + e.metrics.retries, 0),
      },
      passed: overallScore >= 0.6,
      timestamp: Date.now(),
      workspaceId,
    };
  }

  /**
   * Get aggregated evaluation across recorded evaluations, filtered by workspace.
   */
  getAggregated(workspaceId?: string): AggregatedEvaluation {
    const filtered = workspaceId
      ? this.evaluations.filter((e) => e.workspaceId === workspaceId)
      : this.evaluations;

    if (filtered.length === 0) {
      return {
        totalExecutions: 0,
        averageScore: 0,
        scoreDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
        avgMetrics: { durationMs: 0, costDollars: 0, successRate: 0, retryRate: 0 },
        signalAverages: {},
        trend: "stable",
      };
    }

    const total = filtered.length;
    const avgScore = filtered.reduce((sum, e) => sum + e.overallScore, 0) / total;

    // Score distribution
    const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
    for (const e of filtered) {
      if (e.overallScore >= 0.8) distribution.excellent++;
      else if (e.overallScore >= 0.6) distribution.good++;
      else if (e.overallScore >= 0.4) distribution.fair++;
      else distribution.poor++;
    }

    // Average metrics
    const avgDuration = filtered.reduce((sum, e) => sum + e.metrics.durationMs, 0) / total;
    const avgCost = filtered.reduce((sum, e) => sum + e.metrics.costDollars, 0) / total;
    const successRate = filtered.filter((e) => e.metrics.success).length / total;
    const retryRate = filtered.reduce((sum, e) => sum + e.metrics.retries, 0) / total;

    // Per-signal averages
    const signalMap = new Map<string, { sum: number; count: number }>();
    for (const e of filtered) {
      for (const s of e.signals) {
        const existing = signalMap.get(s.name) ?? { sum: 0, count: 0 };
        existing.sum += s.score;
        existing.count++;
        signalMap.set(s.name, existing);
      }
    }
    const signalAverages: Record<string, number> = {};
    for (const [name, { sum, count }] of signalMap) {
      signalAverages[name] = sum / count;
    }

    // Trend (compare first half vs second half)
    const mid = Math.floor(total / 2);
    const firstHalf = filtered.slice(0, mid);
    const secondHalf = filtered.slice(mid);
    const firstAvg = firstHalf.reduce((sum, e) => sum + e.overallScore, 0) / (firstHalf.length || 1);
    const secondAvg = secondHalf.reduce((sum, e) => sum + e.overallScore, 0) / (secondHalf.length || 1);
    const trendDiff = secondAvg - firstAvg;
    const trend = trendDiff > 0.05 ? "improving" : trendDiff < -0.05 ? "degrading" : "stable";

    return {
      totalExecutions: total,
      averageScore: avgScore,
      scoreDistribution: distribution,
      avgMetrics: {
        durationMs: avgDuration,
        costDollars: avgCost,
        successRate,
        retryRate,
      },
      signalAverages,
      trend,
    };
  }

  /**
   * Get recent evaluations, optionally filtered by workspace.
   */
  getRecent(count: number = 10, workspaceId?: string): ExecutionEvaluation[] {
    const filtered = workspaceId
      ? this.evaluations.filter((e) => e.workspaceId === workspaceId)
      : this.evaluations;
    return filtered.slice(-count);
  }

  /**
   * Clear evaluation history.
   */
  clear(): void {
    this.evaluations = [];
  }

  // ============================================
  // INTERNAL SCORING
  // ============================================

  private evaluateCompleteness(output: Record<string, unknown>): number {
    if (!output || Object.keys(output).length === 0) return 0;

    let score = 0;
    const keys = Object.keys(output);

    // Has any data
    if (keys.length > 0) score += 0.3;

    // Has multiple fields
    if (keys.length >= 3) score += 0.2;

    // Has meaningful values (not just empty strings/nulls)
    const meaningfulValues = keys.filter((k) => {
      const v = output[k];
      return v !== null && v !== undefined && v !== "" && v !== 0;
    });
    if (meaningfulValues.length > 0) score += 0.2;
    if (meaningfulValues.length >= keys.length * 0.7) score += 0.3;

    return Math.min(1, score);
  }

  private evaluateSpeed(durationMs: number): number {
    // Speed scoring:
    // < 100ms → 1.0
    // < 500ms → 0.8
    // < 1000ms → 0.6
    // < 5000ms → 0.4
    // > 5000ms → 0.2
    if (durationMs < 100) return 1.0;
    if (durationMs < 500) return 0.8;
    if (durationMs < 1000) return 0.6;
    if (durationMs < 5000) return 0.4;
    return 0.2;
  }

  private evaluateCost(costDollars: number): number {
    // Cost scoring (free is best):
    // $0 → 1.0
    // < $0.001 → 0.8
    // < $0.01 → 0.6
    // < $0.1 → 0.4
    // > $0.1 → 0.2
    if (costDollars === 0) return 1.0;
    if (costDollars < 0.001) return 0.8;
    if (costDollars < 0.01) return 0.6;
    if (costDollars < 0.1) return 0.4;
    return 0.2;
  }

  private computeWeightedScore(signals: EvaluationSignal[]): number {
    if (signals.length === 0) return 0;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const signal of signals) {
      const weight = signal.weight ?? 1;
      weightedSum += signal.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private checkThreshold(
    overallScore: number,
    signals: EvaluationSignal[],
    metrics: { durationMs: number; costDollars: number },
    threshold: QualityThreshold
  ): boolean {
    // Check overall score
    if (overallScore < threshold.minScore) return false;

    // Check signal thresholds
    if (threshold.signalThresholds) {
      for (const [signalName, minScore] of Object.entries(threshold.signalThresholds)) {
        const signal = signals.find((s) => s.name === signalName);
        if (signal && signal.score < minScore) return false;
      }
    }

    // Check duration
    if (threshold.maxDurationMs && metrics.durationMs > threshold.maxDurationMs) return false;

    // Check cost
    if (threshold.maxCostDollars && metrics.costDollars > threshold.maxCostDollars) return false;

    return true;
  }

  private recordEvaluation(evaluation: ExecutionEvaluation): void {
    this.evaluations.push(evaluation);
    // Trim history
    if (this.evaluations.length > this.maxHistory) {
      this.evaluations = this.evaluations.slice(-this.maxHistory);
    }
    // Persist to Supabase (fire-and-forget)
    this.persistToSupabase(evaluation);
  }

  /**
   * Persist an evaluation to Supabase.
   */
  private async persistToSupabase(evaluation: ExecutionEvaluation): Promise<void> {
    try {
      const { supabase } = await import("@/lib/database/supabase");

      await supabase.from("execution_evaluations").insert({
        overall_score: evaluation.overallScore,
        signals: evaluation.signals,
        duration_ms: evaluation.metrics.durationMs,
        cost_dollars: evaluation.metrics.costDollars,
        success: evaluation.metrics.success,
        retries: evaluation.metrics.retries,
        input_tokens: evaluation.metrics.tokens?.input ?? null,
        output_tokens: evaluation.metrics.tokens?.output ?? null,
        feedback: evaluation.feedback ?? null,
        passed: evaluation.passed,
        workspace_id: evaluation.workspaceId ?? null,
      });
    } catch {
      // Silent fail — in-memory is source of truth, DB is backup
    }
  }
}

/**
 * Singleton instance.
 */
let engineInstance: EvaluationEngine | null = null;

export function getEvaluationEngine(): EvaluationEngine {
  if (!engineInstance) {
    engineInstance = new EvaluationEngine();
  }
  return engineInstance;
}

export function resetEvaluationEngine(): void {
  engineInstance = null;
}
