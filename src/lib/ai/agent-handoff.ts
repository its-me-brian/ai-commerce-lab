// Agent-to-Agent Handoff Protocol
// Structured context-passing between agents.
// FASE 27: Agents can suspend, transfer context, and resume after the other completes.

import { z } from "zod";

// --- Zod Schemas ---

export const HandoffStatusSchema = z.enum([
  "pending",     // Created, waiting for target agent to pick up
  "in_progress", // Target agent has started working
  "completed",   // Target agent finished successfully
  "failed",      // Target agent failed
  "returned",    // Results returned to source agent (cycle complete)
]);
export type HandoffStatus = z.infer<typeof HandoffStatusSchema>;

export const HandoffTypeSchema = z.enum([
  "request",  // Agent A asks Agent B for specific information
  "transfer", // Agent A transfers complete work ownership to Agent B
  "return",   // Agent B returns results back to Agent A
]);
export type HandoffType = z.infer<typeof HandoffTypeSchema>;

export const HandoffContextSchema = z.object({
  /** What triggered this handoff */
  reason: z.string(),
  /** Original task context from source agent */
  sourceContext: z.record(z.string(), z.unknown()),
  /** Partial results from source agent (if transfer) */
  partialResults: z.record(z.string(), z.unknown()).optional(),
  /** What the source agent expects back */
  expectedOutput: z.string().optional(),
  /** Deadline (ISO timestamp) */
  deadline: z.string().datetime().optional(),
  /** Priority override */
  priority: z.number().min(1).max(10).optional(),
});
export type HandoffContext = z.infer<typeof HandoffContextSchema>;

export const HandoffResultSchema = z.object({
  /** Success status */
  success: z.boolean(),
  /** Result data */
  data: z.record(z.string(), z.unknown()),
  /** Human-readable summary */
  summary: z.string(),
  /** Any errors encountered */
  errors: z.array(z.string()).optional(),
  /** Tokens used by target agent */
  tokensUsed: z.number().optional(),
  /** Duration in ms */
  durationMs: z.number().optional(),
});
export type HandoffResult = z.infer<typeof HandoffResultSchema>;

export const AgentHandoffSchema = z.object({
  /** Unique handoff ID */
  id: z.string(),
  /** Source agent (initiator) */
  sourceAgentId: z.string(),
  /** Target agent (receiver) */
  targetAgentId: z.string(),
  /** Type of handoff */
  type: HandoffTypeSchema,
  /** Action/request description */
  action: z.string(),
  /** Context for the target agent */
  context: HandoffContextSchema,
  /** Current status */
  status: HandoffStatusSchema,
  /** Result (when completed/returned) */
  result: HandoffResultSchema.optional(),
  /** Created timestamp */
  createdAt: z.string().datetime(),
  /** Updated timestamp */
  updatedAt: z.string().datetime(),
  /** Completed timestamp */
  completedAt: z.string().datetime().optional(),
});
export type AgentHandoff = z.infer<typeof AgentHandoffSchema>;

export const CreateHandoffInputSchema = z.object({
  sourceAgentId: z.string(),
  targetAgentId: z.string(),
  type: HandoffTypeSchema,
  action: z.string(),
  context: HandoffContextSchema,
});
export type CreateHandoffInput = z.infer<typeof CreateHandoffInputSchema>;

export const CompleteHandoffInputSchema = z.object({
  handoffId: z.string(),
  result: HandoffResultSchema,
});
export type CompleteHandoffInput = z.infer<typeof CompleteHandoffInputSchema>;

/**
 * Agent Handoff Manager
 * Manages structured context-passing between agents.
 * Persistence: Handoffs are persisted to Supabase (agent_handoffs table)
 * for survival across restarts. In-memory Map is kept as read cache.
 */
export class AgentHandoffManager {
  private handoffs: Map<string, AgentHandoff> = new Map();
  private nextId = 1;

  /**
   * Create a new handoff between two agents.
   */
  createHandoff(input: CreateHandoffInput): AgentHandoff {
    const now = new Date().toISOString();
    const handoff: AgentHandoff = {
      id: `ho-${this.nextId++}`,
      sourceAgentId: input.sourceAgentId,
      targetAgentId: input.targetAgentId,
      type: input.type,
      action: input.action,
      context: input.context,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    this.handoffs.set(handoff.id, handoff);
    this.persistToSupabase(handoff);
    return handoff;
  }

  /**
   * Mark a handoff as in-progress (target agent picked it up).
   */
  startHandoff(handoffId: string): AgentHandoff | undefined {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff || handoff.status !== "pending") return undefined;

    handoff.status = "in_progress";
    handoff.updatedAt = new Date().toISOString();
    this.updateInSupabase(handoff);
    return handoff;
  }

  /**
   * Complete a handoff with results.
   * If type is "request", results go back to source agent automatically.
   */
  completeHandoff(input: CompleteHandoffInput): AgentHandoff | undefined {
    const handoff = this.handoffs.get(input.handoffId);
    if (!handoff || (handoff.status !== "pending" && handoff.status !== "in_progress")) {
      return undefined;
    }

    handoff.status = input.result.success ? "completed" : "failed";
    handoff.result = input.result;
    handoff.completedAt = new Date().toISOString();
    handoff.updatedAt = new Date().toISOString();
    this.updateInSupabase(handoff);

    return handoff;
  }

  /**
   * Return results to source agent (completes the handoff cycle).
   * Used when target agent wants to explicitly hand back.
   */
  returnHandoff(handoffId: string, result: HandoffResult): AgentHandoff | undefined {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff || handoff.status !== "completed") return undefined;

    handoff.status = "returned";
    handoff.result = result;
    handoff.completedAt = new Date().toISOString();
    handoff.updatedAt = new Date().toISOString();
    this.updateInSupabase(handoff);

    return handoff;
  }

  /**
   * Get a handoff by ID.
   */
  getHandoff(handoffId: string): AgentHandoff | undefined {
    return this.handoffs.get(handoffId);
  }

  /**
   * Get all handoffs involving an agent (as source or target).
   */
  getHandoffsByAgent(agentId: string): AgentHandoff[] {
    return Array.from(this.handoffs.values()).filter(
      (h) => h.sourceAgentId === agentId || h.targetAgentId === agentId
    );
  }

  /**
   * Get handoffs initiated by an agent.
   */
  getOutgoingHandoffs(agentId: string): AgentHandoff[] {
    return Array.from(this.handoffs.values()).filter(
      (h) => h.sourceAgentId === agentId
    );
  }

  /**
   * Get handoffs received by an agent.
   */
  getIncomingHandoffs(agentId: string): AgentHandoff[] {
    return Array.from(this.handoffs.values()).filter(
      (h) => h.targetAgentId === agentId
    );
  }

  /**
   * Get pending handoffs for an agent (needs attention).
   */
  getPendingHandoffs(agentId: string): AgentHandoff[] {
    return this.getIncomingHandoffs(agentId).filter(
      (h) => h.status === "pending"
    );
  }

  /**
   * Get completed handoffs for an agent.
   */
  getCompletedHandoffs(agentId: string): AgentHandoff[] {
    return this.getHandoffsByAgent(agentId).filter(
      (h) => h.status === "completed" || h.status === "returned"
    );
  }

  /**
   * Build context object for the target agent from a handoff.
   * This is what the target agent receives as input.
   */
  buildContextForTarget(handoffId: string): Record<string, unknown> | undefined {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff) return undefined;

    return {
      _handoff: {
        id: handoff.id,
        from: handoff.sourceAgentId,
        action: handoff.action,
        type: handoff.type,
        deadline: handoff.context.deadline,
        priority: handoff.context.priority,
      },
      _reason: handoff.context.reason,
      ...handoff.context.sourceContext,
      ...(handoff.context.partialResults
        ? { _partialResults: handoff.context.partialResults }
        : {}),
      ...(handoff.context.expectedOutput
        ? { _expectedOutput: handoff.context.expectedOutput }
        : {}),
    };
  }

  /**
   * Build context for the source agent when receiving a return.
   * Merges original context with the returned results.
   */
  buildContextForSource(handoffId: string): Record<string, unknown> | undefined {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff || !handoff.result) return undefined;

    return {
      _handoffResult: {
        id: handoff.id,
        from: handoff.targetAgentId,
        success: handoff.result.success,
        summary: handoff.result.summary,
      },
      ...handoff.context.sourceContext,
      ...handoff.result.data,
    };
  }

  /**
   * Get handoff summary statistics.
   */
  getStats(): {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    returned: number;
    byType: Record<HandoffType, number>;
  } {
    const handoffs = Array.from(this.handoffs.values());
    return {
      total: handoffs.length,
      pending: handoffs.filter((h) => h.status === "pending").length,
      inProgress: handoffs.filter((h) => h.status === "in_progress").length,
      completed: handoffs.filter((h) => h.status === "completed").length,
      failed: handoffs.filter((h) => h.status === "failed").length,
      returned: handoffs.filter((h) => h.status === "returned").length,
      byType: {
        request: handoffs.filter((h) => h.type === "request").length,
        transfer: handoffs.filter((h) => h.type === "transfer").length,
        return: handoffs.filter((h) => h.type === "return").length,
      },
    };
  }

  /**
   * Cancel a pending handoff.
   */
  cancelHandoff(handoffId: string): boolean {
    const handoff = this.handoffs.get(handoffId);
    if (!handoff || handoff.status !== "pending") return false;

    handoff.status = "failed";
    handoff.updatedAt = new Date().toISOString();
    handoff.result = {
      success: false,
      data: {},
      summary: "Handoff cancelled by source agent",
      errors: ["Cancelled"],
    };
    this.updateInSupabase(handoff);
    return true;
  }

  /**
   * Check if an agent has any overdue handoffs.
   */
  getOverdueHandoffs(agentId: string): AgentHandoff[] {
    const now = new Date();
    return this.getIncomingHandoffs(agentId).filter(
      (h) =>
        (h.status === "pending" || h.status === "in_progress") &&
        h.context.deadline &&
        new Date(h.context.deadline) < now
    );
  }

  /**
   * Get the full handoff chain for a workflow.
   * Traces from source → target → return, building a chain.
   */
  getHandoffChain(handoffId: string): AgentHandoff[] {
    const chain: AgentHandoff[] = [];
    const visited = new Set<string>();

    let currentId: string | null = handoffId;
    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const handoff = this.handoffs.get(currentId);
      if (!handoff) break;

      chain.push(handoff);

      // Follow the chain: if this is a completed request, look for the return
      if (handoff.status === "completed" && handoff.type === "request") {
        // Find the return handoff from target back to source
        const returnHandoff = Array.from(this.handoffs.values()).find(
          (h) =>
            h.type === "return" &&
            h.sourceAgentId === handoff.targetAgentId &&
            h.targetAgentId === handoff.sourceAgentId &&
            h.context.sourceContext._originalHandoffId === handoff.id
        );
        currentId = returnHandoff?.id || null;
      } else {
        break;
      }
    }

    return chain;
  }

  // ============================================
  // SUPABASE PERSISTENCE
  // ============================================

  /**
   * Persist a handoff to Supabase.
   */
  private async persistToSupabase(handoff: AgentHandoff): Promise<void> {
    try {
      const { supabase } = await import("@/lib/database/supabase");

      await supabase.from("agent_handoffs").insert({
        id: handoff.id,
        source_agent_id: handoff.sourceAgentId,
        target_agent_id: handoff.targetAgentId,
        type: handoff.type,
        action: handoff.action,
        context: handoff.context,
        status: handoff.status,
        result: handoff.result ?? null,
        created_at: handoff.createdAt,
        updated_at: handoff.updatedAt,
        completed_at: handoff.completedAt ?? null,
      });
    } catch {
      // Silent fail — in-memory is source of truth, DB is backup
    }
  }

  /**
   * Update a handoff in Supabase.
   */
  private async updateInSupabase(handoff: AgentHandoff): Promise<void> {
    try {
      const { supabase } = await import("@/lib/database/supabase");

      await supabase.from("agent_handoffs").update({
        status: handoff.status,
        result: handoff.result ?? null,
        updated_at: handoff.updatedAt,
        completed_at: handoff.completedAt ?? null,
      }).eq("id", handoff.id);
    } catch {
      // Silent fail — in-memory is source of truth, DB is backup
    }
  }
}

// Singleton
let instance: AgentHandoffManager | null = null;

export function getAgentHandoffManager(): AgentHandoffManager {
  if (!instance) {
    instance = new AgentHandoffManager();
  }
  return instance;
}
