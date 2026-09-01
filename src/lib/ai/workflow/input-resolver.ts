// Workflow Input Resolver
// Unified system for resolving input references across workflow nodes.
//
// Supports:
//   - "input.field" → reference to original workflow input
//   - "nodeId.output.field" → reference to a completed node's output
//   - "nodeId.output" → reference to the entire node output
//   - Literal values (strings, numbers, booleans)
//   - Nested dot-notation for deep field access
//
// This replaces both OrchestratorV2.mapStepInput() and MiniAIEngine.mapInput()
// with a single, unified resolution system.

import type { WorkflowNodeState, WorkflowNode } from "./types";

/**
 * Resolves input mappings for a workflow node based on completed node outputs.
 */
export class WorkflowInputResolver {
  private nodeStates: Map<string, WorkflowNodeState>;
  private originalInput: Record<string, unknown>;

  constructor(
    nodeStates: Map<string, WorkflowNodeState>,
    originalInput: Record<string, unknown>
  ) {
    this.nodeStates = nodeStates;
    this.originalInput = originalInput;
  }

  /**
   * Resolve input for a node based on its inputMapping.
   *
   * @param node - The workflow node to resolve input for
   * @returns Resolved input object ready to pass to the execution engine
   */
  resolveNodeInput(node: WorkflowNode): Record<string, unknown> {
    if (!node.inputMapping || Object.keys(node.inputMapping).length === 0) {
      return {};
    }

    const resolved: Record<string, unknown> = {};

    for (const [targetKey, sourceRef] of Object.entries(node.inputMapping)) {
      resolved[targetKey] = this.resolveReference(sourceRef);
    }

    return resolved;
  }

  /**
   * Resolve a condition source reference.
   *
   * @param source - Reference string (e.g., "classifier.output.bestCategory")
   * @returns The resolved value, or undefined if not found
   */
  resolveConditionSource(source: string): unknown {
    return this.resolveReference(source);
  }

  /**
   * Resolve a single reference string to its value.
   *
   * Reference formats:
   *   - "input.field.subfield" → originalInput.field.subfield
   *   - "nodeId.output.field" → nodeStates[nodeId].output.field
   *   - "nodeId.output" → nodeStates[nodeId].output
   *   - "literal:value" → literal value (for strings)
   *   - Any other string → treated as a literal string value
   */
  resolveReference(reference: string): unknown {
    if (!reference) return undefined;

    // Literal prefix
    if (reference.startsWith("literal:")) {
      return reference.slice(8);
    }

    // Input reference
    if (reference.startsWith("input.")) {
      const path = reference.slice(6); // Remove "input."
      return this.getNestedValue(this.originalInput, path);
    }

    // Node output reference: "nodeId.field.subfield" or "nodeId.output"
    const dotIndex = reference.indexOf(".");
    if (dotIndex > 0) {
      const nodeId = reference.slice(0, dotIndex);
      const path = reference.slice(dotIndex + 1);

      const state = this.nodeStates.get(nodeId);
      if (!state || state.status !== "completed" || !state.output) {
        return undefined;
      }

      // Special case: "output" alone returns entire output
      if (path === "output") {
        return state.output;
      }

      return this.getNestedValue(state.output, path);
    }

    // No dot — could be a direct node output reference
    const state = this.nodeStates.get(reference);
    if (state && state.status === "completed" && state.output) {
      return state.output;
    }

    // Treat as literal string
    return reference;
  }

  /**
   * Get a nested value from an object using dot-notation path.
   *
   * @param obj - Source object
   * @param path - Dot-notation path (e.g., "bestCategory" or "result.score")
   * @returns The nested value, or undefined if path doesn't exist
   */
  getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    if (!obj || !path) return undefined;

    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof current === "object" && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Check if all dependencies of a node are met.
   * A node's dependencies are all nodeIds referenced in its inputMapping.
   */
  areDependenciesMet(node: WorkflowNode): boolean {
    if (!node.inputMapping) return true;

    for (const sourceRef of Object.values(node.inputMapping)) {
      // Skip input references and literals
      if (sourceRef.startsWith("input.") || sourceRef.startsWith("literal:")) {
        continue;
      }

      // Extract nodeId from reference
      const dotIndex = sourceRef.indexOf(".");
      if (dotIndex > 0) {
        const nodeId = sourceRef.slice(0, dotIndex);
        const state = this.nodeStates.get(nodeId);
        if (!state || state.status !== "completed") {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Get all node IDs that a node depends on (from its inputMapping).
   */
  getDependencies(node: WorkflowNode): string[] {
    const deps = new Set<string>();

    if (!node.inputMapping) return [];

    for (const sourceRef of Object.values(node.inputMapping)) {
      if (sourceRef.startsWith("input.") || sourceRef.startsWith("literal:")) {
        continue;
      }

      const dotIndex = sourceRef.indexOf(".");
      if (dotIndex > 0) {
        const nodeId = sourceRef.slice(0, dotIndex);
        deps.add(nodeId);
      }
    }

    return Array.from(deps);
  }

  /**
   * Collect outputs from specified nodes into an aggregate object.
   */
  collectNodeOutputs(nodeIds: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const nodeId of nodeIds) {
      const state = this.nodeStates.get(nodeId);
      if (state && state.status === "completed" && state.output) {
        result[nodeId] = state.output;
      }
    }

    return result;
  }

  /**
   * Update the resolver's state (call after a node completes).
   */
  updateNodeState(nodeId: string, state: WorkflowNodeState): void {
    this.nodeStates.set(nodeId, state);
  }
}
