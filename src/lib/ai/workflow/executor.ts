// Workflow Executor
// Executes a WorkflowDefinition DAG with mixed agent/mini-AI nodes.
//
// Architecture:
//   1. Validate workflow definition (no cycles, valid nodes)
//   2. Find entry nodes (no dependencies)
//   3. Execute in waves: ready nodes run in parallel, new nodes unlock as deps complete
//   4. Each node is dispatched to the appropriate engine based on its type:
//      - "agent" → AgentEngine
//      - "mini-ai" → MiniAIEngine
//      - "chain" → MiniAIEngine.executeChain()
//      - "condition" → inline logic (no engine needed)
//      - "aggregate" → inline logic (no engine needed)
//   5. Return final output from the designated output node

import { detectCycles } from "../dag-executor";
import { getAgentEngine } from "../../agents/core/engine";
import { getMiniAIEngine } from "../mini-ai/engine";
import type { MiniAIResult } from "../mini-ai/types";
import { WorkflowInputResolver } from "./input-resolver";
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeState,
  WorkflowState,
  WorkflowStatus,
  WorkflowExecutionOptions,
  WorkflowExecutionResult,
  WorkflowCondition,
} from "./types";

/**
 * Default timeout for workflow execution (5 minutes).
 */
const DEFAULT_WORKFLOW_TIMEOUT_MS = 300_000;

/**
 * Default max parallel nodes (no limit).
 */
const DEFAULT_MAX_PARALLEL = Infinity;

/**
 * Workflow Executor — runs a workflow DAG to completion.
 */
export class WorkflowExecutor {
  /**
   * Execute a workflow definition.
   *
   * @param definition - The workflow DAG to execute
   * @param options - Execution options (input, callbacks, etc.)
   * @returns Execution result with final status and output
   */
  async execute(
    definition: WorkflowDefinition,
    options: WorkflowExecutionOptions
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? definition.timeoutMs ?? DEFAULT_WORKFLOW_TIMEOUT_MS;
    const maxParallel = options.maxParallel ?? DEFAULT_MAX_PARALLEL;
    const stopOnError = options.stopOnError ?? definition.stopOnError ?? false;

    // ============================================
    // STEP 1: Validate workflow definition
    // ============================================
    const validationError = this.validateDefinition(definition);
    if (validationError) {
      return this.createErrorResult(definition, options, validationError, startTime);
    }

    // ============================================
    // STEP 2: Initialize state
    // ============================================
    const nodeStates = new Map<string, WorkflowNodeState>();
    for (const node of definition.nodes) {
      nodeStates.set(node.id, {
        nodeId: node.id,
        status: "pending",
        retriesAttempted: 0,
      });
    }

    const state: WorkflowState = {
      workflowId: definition.id,
      status: "running",
      nodeStates,
      input: options.input,
      totalCostDollars: 0,
      totalDurationMs: 0,
      errors: [],
      startedAt: new Date(),
    };

    const resolver = new WorkflowInputResolver(nodeStates, options.input);

    // ============================================
    // STEP 3: Execute in waves
    // ============================================
    const nodeMap = new Map(definition.nodes.map((n) => [n.id, n]));
    const completedNodeIds = new Set<string>();
    let hasMore = true;

    while (hasMore) {
      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        state.status = "timed_out";
        state.errors.push(`Workflow timed out after ${timeoutMs}ms`);
        break;
      }

      // Find ready nodes: pending + all dependencies completed
      const readyNodes: WorkflowNode[] = [];

      for (const node of definition.nodes) {
        const ns = nodeStates.get(node.id);
        if (!ns || ns.status !== "pending") continue;

        // Check if all dependency nodes are completed
        const deps = resolver.getDependencies(node);
        const allDepsMet = deps.every((depId) => completedNodeIds.has(depId));
        if (allDepsMet) {
          readyNodes.push(node);
        }
      }

      if (readyNodes.length === 0) {
        hasMore = false;
        break;
      }

      // Limit parallelism
      const nodesToExecute = readyNodes.slice(0, maxParallel);

      // Execute ready nodes in parallel
      const executions = nodesToExecute.map(async (node) => {
        await this.executeNode(node, state, resolver, nodeMap, definition, options);
      });

      await Promise.all(executions);

      // Check timeout after execution
      if (Date.now() - startTime > timeoutMs) {
        state.status = "timed_out";
        state.errors.push(`Workflow timed out after ${timeoutMs}ms`);
        break;
      }

      // Mark completed/failed/skipped nodes
      for (const node of nodesToExecute) {
        const ns = nodeStates.get(node.id)!;
        if (ns.status === "completed" || ns.status === "skipped") {
          completedNodeIds.add(node.id);
        } else if (ns.status === "failed") {
          // Check if failure should stop the workflow
          if (stopOnError && node.required !== false) {
            state.status = "failed";
            state.errors.push(`Required node "${node.id}" failed: ${ns.error}`);
            hasMore = false;
            break;
          }
          // Mark as completed for DAG traversal (to unblock downstream nodes)
          completedNodeIds.add(node.id);
        }
      }

      // Check if all nodes are done
      const allDone = definition.nodes.every((node) => {
        const ns = nodeStates.get(node.id);
        return ns && ["completed", "skipped", "failed", "cancelled"].includes(ns.status);
      });
      if (allDone) {
        hasMore = false;
      }
    }

    // ============================================
    // STEP 4: Determine final status and output
    // ============================================
    state.totalDurationMs = Date.now() - startTime;
    state.completedAt = new Date();

    if (state.status === "running") {
      const hasFailed = Array.from(nodeStates.values()).some(
        (ns) => ns.status === "failed" && nodeMap.get(ns.nodeId)?.required !== false
      );
      state.status = hasFailed ? "failed" : "completed";
    }

    // Collect output from the last completed node, or aggregate all outputs
    state.output = this.collectWorkflowOutput(definition, nodeStates);

    // Fire callbacks
    if (options.onWorkflowComplete) {
      options.onWorkflowComplete(state);
    }

    return this.buildResult(state, definition.nodes.length);
  }

  // ============================================
  // NODE EXECUTION
  // ============================================

  private async executeNode(
    node: WorkflowNode,
    state: WorkflowState,
    resolver: WorkflowInputResolver,
    nodeMap: Map<string, WorkflowNode>,
    definition: WorkflowDefinition,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    const ns = state.nodeStates.get(node.id)!;
    const nodeStartMs = Date.now();

    ns.status = "running";
    ns.startedAtMs = 0; // Relative to workflow start
    this.notifyNodeStateChange(node.id, ns, options);

    try {
      let output: Record<string, unknown>;

      switch (node.type) {
        case "agent":
          output = await this.executeAgentNode(node, resolver);
          break;
        case "mini-ai":
          output = await this.executeMiniAINode(node, resolver);
          break;
        case "chain":
          output = await this.executeChainNode(node, resolver);
          break;
        case "condition":
          output = await this.executeConditionNode(node, resolver, nodeMap);
          break;
        case "aggregate":
          output = await this.executeAggregateNode(node, resolver, definition);
          break;
        default:
          throw new Error(`Unknown node type: ${(node as WorkflowNode).type}`);
      }

      ns.status = "completed";
      ns.output = output;
      ns.completedAtMs = Date.now() - state.startedAt.getTime();
      ns.durationMs = Date.now() - nodeStartMs;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // Handle retries
      const maxRetries = node.maxRetries ?? 0;
      if (ns.retriesAttempted < maxRetries) {
        ns.retriesAttempted++;
        ns.status = "retrying";
        this.notifyNodeStateChange(node.id, ns, options);

        const delay = node.retryDelayMs ?? 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Re-execute
        return this.executeNode(node, state, resolver, nodeMap, definition, options);
      }

      ns.status = "failed";
      ns.error = msg;
      ns.completedAtMs = Date.now() - state.startedAt.getTime();
      ns.durationMs = Date.now() - nodeStartMs;

      if (node.required !== false) {
        state.errors.push(`Node "${node.id}" failed: ${msg}`);
      }
    }

    resolver.updateNodeState(node.id, ns);
    this.notifyNodeStateChange(node.id, ns, options);
  }

  // ============================================
  // NODE TYPE EXECUTORS
  // ============================================

  /**
   * Execute an agent node via AgentEngine.
   */
  private async executeAgentNode(
    node: WorkflowNode,
    resolver: WorkflowInputResolver
  ): Promise<Record<string, unknown>> {
    if (!node.agentId) {
      throw new Error(`Agent node "${node.id}" is missing agentId`);
    }

    const input = resolver.resolveNodeInput(node);
    const engine = getAgentEngine();
    const { result } = await engine.executeTask(node.agentId, input);

    if (!result.success) {
      throw new Error(result.errors?.join(", ") || "Agent execution failed");
    }

    // Merge output and structuredData
    return {
      content: result.output,
      ...((result.structuredData as Record<string, unknown>) || {}),
    };
  }

  /**
   * Execute a mini-AI node via MiniAIEngine.
   */
  private async executeMiniAINode(
    node: WorkflowNode,
    resolver: WorkflowInputResolver
  ): Promise<Record<string, unknown>> {
    if (!node.miniAIId) {
      throw new Error(`Mini-AI node "${node.id}" is missing miniAIId`);
    }

    const input = resolver.resolveNodeInput(node);
    const engine = getMiniAIEngine();
    const result: MiniAIResult = await engine.execute(node.miniAIId, { input });

    if (!result.success) {
      throw new Error(result.errors?.join(", ") || "Mini-AI execution failed");
    }

    return result.output || {};
  }

  /**
   * Execute a chain node (sequence of mini-IAs).
   */
  private async executeChainNode(
    node: WorkflowNode,
    resolver: WorkflowInputResolver
  ): Promise<Record<string, unknown>> {
    if (!node.chainSteps || node.chainSteps.length === 0) {
      throw new Error(`Chain node "${node.id}" has no steps`);
    }

    const engine = getMiniAIEngine();
    const initialInput = resolver.resolveNodeInput(node);

    const chainResults = await engine.executeChain(
      node.chainSteps.map((step) => ({
        miniAIId: step.miniAIId,
        inputMapping: step.inputMapping,
      })),
      initialInput
    );

    // Check if any required step failed
    for (let i = 0; i < chainResults.length; i++) {
      if (!chainResults[i].success && node.chainSteps[i].required !== false) {
        throw new Error(
          `Chain step ${i} (${node.chainSteps[i].miniAIId}) failed: ${chainResults[i].errors?.join(", ")}`
        );
      }
    }

    // Return merged output from all chain steps
    const mergedOutput: Record<string, unknown> = {};
    for (const result of chainResults) {
      if (result.success && result.output) {
        Object.assign(mergedOutput, result.output);
      }
    }

    return mergedOutput;
  }

  /**
   * Execute a condition node — evaluate condition and return which branch to follow.
   */
  private async executeConditionNode(
    node: WorkflowNode,
    resolver: WorkflowInputResolver,
    _nodeMap: Map<string, WorkflowNode>
  ): Promise<Record<string, unknown>> {
    if (!node.condition) {
      throw new Error(`Condition node "${node.id}" has no condition defined`);
    }

    const conditionMet = this.evaluateCondition(node.condition, resolver);

    return {
      conditionResult: conditionMet,
      branchTaken: conditionMet ? node.condition.branches.true : node.condition.branches.false,
    };
  }

  /**
   * Execute an aggregate node — combine outputs from parent nodes.
   */
  private async executeAggregateNode(
    node: WorkflowNode,
    resolver: WorkflowInputResolver,
    definition: WorkflowDefinition
  ): Promise<Record<string, unknown>> {
    if (!node.aggregation) {
      throw new Error(`Aggregate node "${node.id}" has no aggregation defined`);
    }

    // Find all parent nodes (nodes that this node depends on)
    const deps = resolver.getDependencies(node);
    const parentOutputs = resolver.collectNodeOutputs(deps);

    switch (node.aggregation.strategy) {
      case "merge":
        return this.aggregateMerge(parentOutputs, node.aggregation.mergeKey);

      case "array":
        return this.aggregateArray(parentOutputs);

      case "concat":
        return this.aggregateConcat(parentOutputs);

      default:
        throw new Error(`Unknown aggregation strategy: ${node.aggregation.strategy}`);
    }
  }

  // ============================================
  // AGGREGATION STRATEGIES
  // ============================================

  private aggregateMerge(
    parentOutputs: Record<string, unknown>,
    mergeKey?: string
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const [nodeId, output] of Object.entries(parentOutputs)) {
      if (typeof output === "object" && output !== null) {
        Object.assign(merged, output);
      } else {
        merged[nodeId] = output;
      }
    }

    if (mergeKey) {
      return { [mergeKey]: merged };
    }
    return merged;
  }

  private aggregateArray(parentOutputs: Record<string, unknown>): Record<string, unknown> {
    const items = Object.values(parentOutputs);
    return { items, count: items.length };
  }

  private aggregateConcat(parentOutputs: Record<string, unknown>): Record<string, unknown> {
    const parts: string[] = [];
    for (const output of Object.values(parentOutputs)) {
      if (typeof output === "string") {
        parts.push(output);
      } else if (typeof output === "object" && output !== null) {
        const content = (output as Record<string, unknown>).content;
        if (typeof content === "string") {
          parts.push(content);
        }
      }
    }
    return { content: parts.join("\n") };
  }

  // ============================================
  // CONDITION EVALUATION
  // ============================================

  private evaluateCondition(
    condition: WorkflowCondition,
    resolver: WorkflowInputResolver
  ): boolean {
    const value = resolver.resolveConditionSource(condition.source);

    switch (condition.operator) {
      case "equals":
        return value === condition.value;
      case "not_equals":
        return value !== condition.value;
      case "gt":
        return Number(value) > Number(condition.value);
      case "lt":
        return Number(value) < Number(condition.value);
      case "gte":
        return Number(value) >= Number(condition.value);
      case "lte":
        return Number(value) <= Number(condition.value);
      case "contains":
        return String(value).includes(String(condition.value));
      case "exists":
        return value !== undefined && value !== null;
      case "not_empty":
        if (value === undefined || value === null) return false;
        if (typeof value === "string") return value.length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === "object") return Object.keys(value).length > 0;
        return true;
      default:
        return false;
    }
  }

  // ============================================
  // OUTPUT COLLECTION
  // ============================================

  private collectWorkflowOutput(
    definition: WorkflowDefinition,
    nodeStates: Map<string, WorkflowNodeState>
  ): Record<string, unknown> {
    // Find the last completed node (by execution order)
    const completedNodes: WorkflowNodeState[] = [];
    for (const node of definition.nodes) {
      const ns = nodeStates.get(node.id);
      if (ns && ns.status === "completed" && ns.output) {
        completedNodes.push(ns);
      }
    }

    if (completedNodes.length === 0) {
      return {};
    }

    // Return output from the last completed node
    const lastCompleted = completedNodes[completedNodes.length - 1];
    return lastCompleted.output || {};
  }

  // ============================================
  // VALIDATION
  // ============================================

  private validateDefinition(definition: WorkflowDefinition): string | null {
    if (!definition.nodes || definition.nodes.length === 0) {
      return "Workflow has no nodes";
    }

    // Check for duplicate node IDs
    const ids = new Set<string>();
    for (const node of definition.nodes) {
      if (ids.has(node.id)) {
        return `Duplicate node ID: ${node.id}`;
      }
      ids.add(node.id);
    }

    // Check for cycles using existing DAG utility
    const taskLike = definition.nodes.map((n) => ({
      id: n.id,
      depends_on: this.getNodeDependencies(n, definition),
    }));

    const cycle = detectCycles(taskLike);
    if (cycle) {
      return `Cycle detected: ${cycle.join(" → ")}`;
    }

    // Validate each node
    for (const node of definition.nodes) {
      const error = this.validateNode(node);
      if (error) return `Node "${node.id}": ${error}`;
    }

    return null;
  }

  private validateNode(node: WorkflowNode): string | null {
    if (!node.id) return "Missing node ID";
    if (!node.name) return "Missing node name";

    switch (node.type) {
      case "agent":
        if (!node.agentId) return "Agent node missing agentId";
        break;
      case "mini-ai":
        if (!node.miniAIId) return "Mini-AI node missing miniAIId";
        break;
      case "chain":
        if (!node.chainSteps || node.chainSteps.length === 0) {
          return "Chain node missing chainSteps";
        }
        break;
      case "condition":
        if (!node.condition) return "Condition node missing condition";
        if (!node.condition.branches?.true) {
          return "Condition node missing branches.true";
        }
        break;
      case "aggregate":
        if (!node.aggregation) return "Aggregate node missing aggregation";
        break;
    }

    return null;
  }

  private getNodeDependencies(
    node: WorkflowNode,
    _definition: WorkflowDefinition
  ): string[] {
    const deps: string[] = [];

    if (node.inputMapping) {
      for (const sourceRef of Object.values(node.inputMapping)) {
        if (sourceRef.startsWith("input.") || sourceRef.startsWith("literal:")) {
          continue;
        }
        const dotIndex = sourceRef.indexOf(".");
        if (dotIndex > 0) {
          deps.push(sourceRef.slice(0, dotIndex));
        }
      }
    }

    return deps;
  }

  // ============================================
  // HELPERS
  // ============================================

  private notifyNodeStateChange(
    nodeId: string,
    state: WorkflowNodeState,
    options: WorkflowExecutionOptions
  ): void {
    if (options.onNodeStateChange) {
      options.onNodeStateChange(nodeId, { ...state });
    }
  }

  private createErrorResult(
    definition: WorkflowDefinition,
    options: WorkflowExecutionOptions,
    error: string,
    startTime: number
  ): WorkflowExecutionResult {
    const state: WorkflowState = {
      workflowId: definition.id,
      status: "failed",
      nodeStates: new Map(),
      input: options.input,
      totalCostDollars: 0,
      totalDurationMs: Date.now() - startTime,
      errors: [error],
      startedAt: new Date(),
      completedAt: new Date(),
    };

    return this.buildResult(state, definition.nodes.length);
  }

  private buildResult(
    state: WorkflowState,
    totalNodes: number
  ): WorkflowExecutionResult {
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    let pending = 0;

    for (const ns of state.nodeStates.values()) {
      switch (ns.status) {
        case "completed":
          completed++;
          break;
        case "failed":
          failed++;
          break;
        case "skipped":
          skipped++;
          break;
        case "pending":
        case "ready":
          pending++;
          break;
      }
    }

    return {
      status: state.status,
      state,
      output: state.output || {},
      summary: {
        totalNodes,
        completed,
        failed,
        skipped,
        pending,
        totalCostDollars: state.totalCostDollars,
        totalDurationMs: state.totalDurationMs,
      },
    };
  }
}

/**
 * Singleton instance.
 */
let executorInstance: WorkflowExecutor | null = null;

export function getWorkflowExecutor(): WorkflowExecutor {
  if (!executorInstance) {
    executorInstance = new WorkflowExecutor();
  }
  return executorInstance;
}

export function resetWorkflowExecutor(): void {
  executorInstance = null;
}
