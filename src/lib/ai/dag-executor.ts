// DAG Task Executor
// Executes tasks in dependency order (Directed Acyclic Graph).
// FASE 15: Ready tasks run in parallel, new tasks unlock as deps complete.

import { getTaskEngine, type Task, type TaskStatus } from "./task-engine";

export interface DAGExecutionResult {
  totalTasks: number;
  completed: number;
  failed: number;
  cancelled: number;
  results: Map<string, { status: TaskStatus; output?: Record<string, unknown>; error?: string }>;
}

export type TaskExecutor = (
  task: Task
) => Promise<Record<string, unknown>>;

/**
 * Execute a DAG of tasks in dependency order.
 * Independent tasks run in parallel.
 */
export async function executeDAG(
  taskIds: string[],
  executor: TaskExecutor
): Promise<DAGExecutionResult> {
  const engine = getTaskEngine();
  const results = new Map<string, { status: TaskStatus; output?: Record<string, unknown>; error?: string }>();
  let completed = 0;
  let failed = 0;
  let cancelled = 0;

  // Build a set of all task IDs we care about
  const allTaskIds = new Set(taskIds);

  // Execute in waves
  let hasMore = true;

  while (hasMore) {
    // Find ready tasks: pending + all deps completed (or no deps in our set)
    const pendingTasks: Task[] = [];

    for (const taskId of allTaskIds) {
      if (results.has(taskId)) continue; // Already processed

      const task = await engine.getById(taskId);
      if (!task) {
        results.set(taskId, { status: "failed", error: "Task not found" });
        failed++;
        continue;
      }

      if (task.status !== "pending") {
        // Already started by someone else
        results.set(taskId, { status: task.status });
        if (task.status === "completed") completed++;
        else if (task.status === "failed") failed++;
        else if (task.status === "cancelled") cancelled++;
        continue;
      }

      // Check if dependencies are met
      const depsMet = await engine.areDependenciesMet(taskId);
      if (depsMet) {
        pendingTasks.push(task);
      }
    }

    if (pendingTasks.length === 0) {
      hasMore = false;
      break;
    }

    // Execute ready tasks in parallel
    const executions = pendingTasks.map(async (task) => {
      try {
        await engine.start(task.id);
        const output = await executor(task);
        await engine.complete(task.id, output);
        results.set(task.id, { status: "completed", output });
        completed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        await engine.fail(task.id, errorMsg);
        results.set(task.id, { status: "failed", error: errorMsg });
        failed++;
      }
    });

    await Promise.all(executions);

    // Check if we made progress
    const newReady = await engine.getReadyTasks();
    const anyNew = newReady.some((t) => !results.has(t.id));
    if (!anyNew) {
      hasMore = false;
    }
  }

  return {
    totalTasks: taskIds.length,
    completed,
    failed,
    cancelled,
    results,
  };
}

/**
 * Validate that a set of tasks has no circular dependencies.
 * Returns null if valid, or the cycle path if circular.
 */
export function detectCycles(
  tasks: Array<{ id: string; depends_on: string[] }>
): string[] | null {
  const taskMap = new Map(tasks.map((t) => [t.id, t.depends_on]));
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): string[] | null {
    if (inStack.has(node)) {
      // Found a cycle — return the cycle path
      const cycleStart = path.indexOf(node);
      return path.slice(cycleStart).concat(node);
    }
    if (visited.has(node)) return null;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    const deps = taskMap.get(node) ?? [];
    for (const dep of deps) {
      const cycle = dfs(dep, [...path]);
      if (cycle) return cycle;
    }

    inStack.delete(node);
    return null;
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      const cycle = dfs(task.id, []);
      if (cycle) return cycle;
    }
  }

  return null;
}

/**
 * Get the execution order of tasks (topological sort).
 * Returns tasks in order, with dependencies first.
 * Returns null if cycle detected.
 */
export function topologicalSort(
  tasks: Array<{ id: string; depends_on: string[] }>
): string[] | null {
  const taskMap = new Map(tasks.map((t) => [t.id, t.depends_on]));
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const result: string[] = [];

  function visit(node: string): boolean {
    if (inStack.has(node)) return false; // Cycle detected
    if (visited.has(node)) return true;  // Already processed

    visited.add(node);
    inStack.add(node);

    const deps = taskMap.get(node) ?? [];
    for (const dep of deps) {
      if (!taskMap.has(dep)) continue; // External dep, skip
      if (!visit(dep)) return false;
    }

    inStack.delete(node);
    result.push(node);
    return true;
  }

  for (const task of tasks) {
    if (!visit(task.id)) return null;
  }

  return result;
}
