// Workflow v2 Types
// Unified DAG abstraction where agents and mini-IAs are interchangeable nodes.
//
// This bridges the gap between:
//   - dag-executor.ts (DB-based task execution)
//   - mini-ai/engine.ts (in-memory mini-AI chains)
//   - orchestrator-v2.ts (planning + delegation)
//
// Key concept: WorkflowNode is the universal building block.
// A workflow is a directed acyclic graph (DAG) of nodes.

import type { MiniAIResult } from "./mini-ai/types";

// ============================================
// WORKFLOW NODE TYPES
// ============================================

/**
 * The type of node — determines which engine executes it.
 */
export type WorkflowNodeType =
  | "agent"         // Executes via AgentEngine
  | "mini-ai"       // Executes via MiniAIEngine
  | "chain"         // Executes a sequence of mini-IAs via MiniAIEngine.executeChain()
  | "condition"     // Pure logic — evaluates a condition and routes to branches
  | "aggregate";    // Pure logic — combines outputs from multiple parent nodes

/**
 * A single node in the workflow DAG.
 */
export interface WorkflowNode {
  /** Unique node identifier within the workflow */
  id: string;

  /** Human-readable name */
  name: string;

  /** Node type — determines execution engine */
  type: WorkflowNodeType;

  /** Node description */
  description?: string;

  // --- Agent-specific fields ---
  /** Agent ID (required when type = "agent") */
  agentId?: string;

  // --- Mini-AI-specific fields ---
  /** Mini-AI ID (required when type = "mini-ai") */
  miniAIId?: string;

  // --- Chain-specific fields ---
  /** Chain steps (required when type = "chain") */
  chainSteps?: WorkflowChainStep[];

  // --- Condition-specific fields ---
  /** Condition expression (required when type = "condition") */
  condition?: WorkflowCondition;

  // --- Aggregate-specific fields ---
  /** How to aggregate parent outputs (required when type = "aggregate") */
  aggregation?: WorkflowAggregation;

  // --- Common fields ---
  /** Input mapping from parent node outputs or original workflow input */
  inputMapping?: Record<string, string>;

  /** Whether this node is required (default: true). If false, workflow continues on failure */
  required?: boolean;

  /** Timeout in ms for this node (overrides workflow-level timeout) */
  timeoutMs?: number;

  /** Max retries for this node (default: 0) */
  maxRetries?: number;

  /** Retry delay in ms (default: 1000) */
  retryDelayMs?: number;
}

/**
 * A step within a chain node.
 */
export interface WorkflowChainStep {
  /** Mini-AI to execute */
  miniAIId: string;

  /** Input mapping from chain context */
  inputMapping: Record<string, string>;

  /** Whether this step is required (default: true) */
  required?: boolean;
}

/**
 * Condition for conditional nodes.
 * Evaluates parent node outputs and returns a branch to follow.
 */
export interface WorkflowCondition {
  /**
   * Source reference — the node output field to check.
   * Format: "nodeId.field.subfield" or "input.field"
   */
  source: string;

  /** Comparison operator */
  operator: "equals" | "not_equals" | "gt" | "lt" | "gte" | "lte" | "contains" | "exists" | "not_empty";

  /** Value to compare against (for equals, gt, lt, etc.) */
  value?: unknown;

  /**
   * Branch mapping — which node to execute based on condition result.
   * true = condition met, false = condition not met.
   */
  branches: {
    true: string;   // Node ID to execute when condition is true
    false?: string; // Node ID to execute when condition is false (optional — skip if not set)
  };
}

/**
 * Aggregation strategy for aggregate nodes.
 */
export type WorkflowAggregationType =
  | "merge"        // Shallow merge all parent outputs into one object
  | "array"        // Collect all parent outputs into an array
  | "concat"       // Concatenate string outputs
  | "custom";      // Custom aggregation function (by ID)

/**
 * Configuration for aggregate nodes.
 */
export interface WorkflowAggregation {
  /** Aggregation strategy */
  strategy: WorkflowAggregationType;

  /** For custom aggregation: the aggregation function ID */
  aggregationFnId?: string;

  /** Key to use in the merged object (for "merge" strategy) */
  mergeKey?: string;
}

// ============================================
// WORKFLOW DEFINITION
// ============================================

/**
 * A complete workflow definition — declarative DAG of nodes.
 */
export interface WorkflowDefinition {
  /** Unique workflow identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description */
  description: string;

  /** Workflow version */
  version: string;

  /** Tags for categorization */
  tags?: string[];

  /** All nodes in the workflow */
  nodes: WorkflowNode[];

  /**
   * Entry points — node IDs that have no dependencies.
   * If omitted, auto-detected from nodes with no inputMapping references.
   */
  entryNodes?: string[];

  /** Max total execution time in ms (default: 300000 = 5 minutes) */
  timeoutMs?: number;

  /** Whether to stop all nodes on first required failure (default: false) */
  stopOnError?: boolean;

  /** Whether this workflow is enabled */
  enabled?: boolean;
}

// ============================================
// WORKFLOW EXECUTION STATE
// ============================================

/**
 * Status of a workflow node during execution.
 */
export type WorkflowNodeStatus =
  | "pending"      // Waiting for dependencies
  | "ready"        // Dependencies met, waiting to be scheduled
  | "running"      // Currently executing
  | "completed"    // Executed successfully
  | "failed"       // Execution failed
  | "skipped"      // Skipped (condition not met or optional failure)
  | "retrying"     // Waiting for retry
  | "cancelled";   // Cancelled by parent failure

/**
 * Status of the entire workflow.
 */
export type WorkflowStatus =
  | "pending"      // Not yet started
  | "running"      // At least one node is running
  | "completed"    // All nodes completed
  | "failed"       // A required node failed
  | "cancelled"    // Cancelled by user or system
  | "timed_out";   // Exceeded timeout

/**
 * Runtime state of a single node.
 */
export interface WorkflowNodeState {
  /** Node ID */
  nodeId: string;

  /** Current status */
  status: WorkflowNodeStatus;

  /** Node output (set on completion) */
  output?: Record<string, unknown>;

  /** Error message (set on failure) */
  error?: string;

  /** Number of retries attempted */
  retriesAttempted: number;

  /** Start time in ms (relative to workflow start) */
  startedAtMs?: number;

  /** End time in ms */
  completedAtMs?: number;

  /** Duration in ms */
  durationMs?: number;

  /** Cost in dollars (for agent/mini-ai nodes) */
  costDollars?: number;

  /** Execution mode used (deterministic, llm, hybrid) */
  executionMode?: string;
}

/**
 * Complete state of a running/completed workflow.
 */
export interface WorkflowState {
  /** Workflow definition ID */
  workflowId: string;

  /** Current workflow status */
  status: WorkflowStatus;

  /** State of each node */
  nodeStates: Map<string, WorkflowNodeState>;

  /** Shared working memory across all nodes */
  workingMemory: Record<string, unknown>;

  /** Original workflow input */
  input: Record<string, unknown>;

  /** Final output (from designated output node, or aggregated) */
  output?: Record<string, unknown>;

  /** Total cost in dollars */
  totalCostDollars: number;

  /** Total duration in ms */
  totalDurationMs: number;

  /** Workflow-level errors (not tied to a specific node) */
  errors: string[];

  /** Start timestamp */
  startedAt: Date;

  /** End timestamp */
  completedAt?: Date;
}

// ============================================
// WORKFLOW EXECUTION OPTIONS
// ============================================

/**
 * Options for workflow execution.
 */
export interface WorkflowExecutionOptions {
  /** Original input to the workflow */
  input: Record<string, unknown>;

  /** Maximum parallel nodes (default: Infinity — no limit) */
  maxParallel?: number;

  /** Override timeout for the entire workflow */
  timeoutMs?: number;

  /** Whether to stop on first required node failure (default: false) */
  stopOnError?: boolean;

  /** Callback for node state changes */
  onNodeStateChange?: (nodeId: string, state: WorkflowNodeState) => void;

  /** Callback for workflow completion */
  onWorkflowComplete?: (state: WorkflowState) => void;
}

// ============================================
// WORKFLOW EXECUTION RESULT
// ============================================

/**
 * Result of a complete workflow execution.
 */
export interface WorkflowExecutionResult {
  /** Final workflow status */
  status: WorkflowStatus;

  /** Final workflow state */
  state: WorkflowState;

  /** Final output */
  output: Record<string, unknown>;

  /** Summary of node execution */
  summary: {
    totalNodes: number;
    completed: number;
    failed: number;
    skipped: number;
    pending: number;
    totalCostDollars: number;
    totalDurationMs: number;
  };
}

// ============================================
// WORKFLOW REGISTRY TYPES
// ============================================

/**
 * Query options for the workflow registry.
 */
export interface WorkflowQueryOptions {
  tags?: string[];
  enabled?: boolean;
  nameContains?: string;
}
