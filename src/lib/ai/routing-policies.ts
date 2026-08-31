// Routing Policies
// Determines which route to use based on the agent's routing policy.
// FASE 11: priority, cheapest, fastest selection strategies.

import type { AgentModelRoute } from "./agent-model-routes";
import type { ModelRecord } from "./model-registry";
import type { RouterExecutionLog } from "./router";

export type RoutingPolicy = "priority" | "cheapest" | "fastest";

/**
 * Select the best route from a list based on policy.
 *
 * - priority: lowest priority number wins (0 > 1 > 2)
 * - cheapest: lowest total cost (input + output) wins
 * - fastest: lowest average latency from execution logs wins
 */
export function selectRoute(
  routes: AgentModelRoute[],
  models: Map<string, ModelRecord>,
  policy: RoutingPolicy,
  executionLogs?: RouterExecutionLog[]
): AgentModelRoute | null {
  if (routes.length === 0) return null;

  switch (policy) {
    case "priority":
      return selectByPriority(routes);

    case "cheapest":
      return selectByCheapest(routes, models);

    case "fastest":
      return selectByFastest(routes, models, executionLogs);

    default:
      // Unknown policy — fallback to priority
      return selectByPriority(routes);
  }
}

/**
 * Select by priority: lowest number = highest priority.
 */
function selectByPriority(routes: AgentModelRoute[]): AgentModelRoute {
  return routes.reduce((best, current) =>
    current.priority < best.priority ? current : best
  );
}

/**
 * Select by cheapest: lowest total cost (input_price + output_price).
 * Free models (price = 0) are preferred.
 */
function selectByCheapest(
  routes: AgentModelRoute[],
  models: Map<string, ModelRecord>
): AgentModelRoute {
  return routes.reduce((best, current) => {
    const bestModel = models.get(best.model_id);
    const currentModel = models.get(current.model_id);

    const bestCost = bestModel
      ? bestModel.input_price + bestModel.output_price
      : Infinity;
    const currentCost = currentModel
      ? currentModel.input_price + currentModel.output_price
      : Infinity;

    return currentCost < bestCost ? current : best;
  });
}

/**
 * Select by fastest: lowest average latency from execution logs.
 * If no logs available, falls back to priority.
 */
function selectByFastest(
  routes: AgentModelRoute[],
  models: Map<string, ModelRecord>,
  executionLogs?: RouterExecutionLog[]
): AgentModelRoute {
  if (!executionLogs || executionLogs.length === 0) {
    // No execution data — fallback to priority
    return selectByPriority(routes);
  }

  // Calculate average latency per model
  const latencyByModel = new Map<string, { total: number; count: number }>();
  for (const log of executionLogs) {
    if (!log.success) continue; // Only count successful executions
    const key = log.model;
    const existing = latencyByModel.get(key) ?? { total: 0, count: 0 };
    existing.total += log.durationMs;
    existing.count += 1;
    latencyByModel.set(key, existing);
  }

  // Find route with lowest average latency
  let bestRoute = routes[0];
  let bestLatency = Infinity;

  for (const route of routes) {
    const stats = latencyByModel.get(route.model_id);
    if (stats && stats.count > 0) {
      const avgLatency = stats.total / stats.count;
      if (avgLatency < bestLatency) {
        bestLatency = avgLatency;
        bestRoute = route;
      }
    }
  }

  // If no route has latency data, fallback to priority
  if (bestLatency === Infinity) {
    return selectByPriority(routes);
  }

  return bestRoute;
}

/**
 * Get a human-readable explanation of why a route was selected.
 */
export function explainSelection(
  route: AgentModelRoute,
  policy: RoutingPolicy,
  models: Map<string, ModelRecord>,
  executionLogs?: RouterExecutionLog[]
): string {
  const model = models.get(route.model_id);

  switch (policy) {
    case "priority":
      return `Selected by priority (rank ${route.priority})`;

    case "cheapest": {
      const cost = model
        ? `$${model.input_price}/M in + $${model.output_price}/M out`
        : "unknown cost";
      return `Selected as cheapest option (${cost})`;
    }

    case "fastest": {
      if (!executionLogs) return "Selected by priority (no latency data)";
      const modelLogs = executionLogs.filter(
        (l) => l.model === route.model_id && l.success
      );
      if (modelLogs.length === 0)
        return "Selected by priority (no latency data for this model)";
      const avgLatency =
        modelLogs.reduce((sum, l) => sum + l.durationMs, 0) /
        modelLogs.length;
      return `Selected as fastest (avg ${Math.round(avgLatency)}ms over ${modelLogs.length} runs)`;
    }

    default:
      return `Selected by ${policy}`;
  }
}
