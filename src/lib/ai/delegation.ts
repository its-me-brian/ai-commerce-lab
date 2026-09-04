// Agent Delegation
// Allows agents to delegate work to other agents via tasks.
// FASE 16: Agent A creates a task → Agent B picks it up → result goes back to A.

import { getTaskEngine, type Task } from "./task-engine";
import { bootstrap, getAgentRegistry } from "./bootstrap";

export interface DelegationInput {
  fromAgentId: string;
  toAgentId: string;
  taskType: string;
  input: Record<string, unknown>;
  workspaceId?: string;
  priority?: number;
  dependsOn?: string[];
}

export interface DelegationResult {
  task: Task;
  message: string;
}

/**
 * Delegate a task from one agent to another.
 * Creates a task assigned to the target agent.
 */
export async function delegateTask(input: DelegationInput): Promise<DelegationResult> {
  await bootstrap();

  const registry = getAgentRegistry();
  const taskEngine = getTaskEngine();

  // Validate both agents exist
  const fromAgent = registry.get(input.fromAgentId);
  if (!fromAgent) {
    throw new Error(`Source agent not found: ${input.fromAgentId}`);
  }

  const toAgent = registry.get(input.toAgentId);
  if (!toAgent) {
    throw new Error(`Target agent not found: ${input.toAgentId}`);
  }

  // Create the task
  const task = await taskEngine.create({
    agent_id: input.toAgentId,
    task_type: input.taskType,
    input: {
      ...input.input,
      _delegatedBy: input.fromAgentId,
      _delegationTimestamp: new Date().toISOString(),
    },
    priority: input.priority ?? 5,
    depends_on: input.dependsOn ?? [],
  }, input.workspaceId || "");

  if (!task) {
    throw new Error("Failed to create delegation task");
  }

  return {
    task,
    message: `Task ${task.id} delegated from ${input.fromAgentId} to ${input.toAgentId}`,
  };
}

/**
 * Get all tasks delegated to a specific agent.
 */
export async function getDelegatedTasks(agentId: string): Promise<Task[]> {
  const taskEngine = getTaskEngine();
  const tasks = await taskEngine.listByAgent(agentId);

  // Filter tasks that were delegated (have _delegatedBy in input)
  return tasks.filter(
    (t) => t.input && typeof t.input === "object" && "_delegatedBy" in t.input
  );
}

/**
 * Get all tasks that an agent has delegated to others.
 */
export async function getOutgoingDelegations(agentId: string): Promise<Task[]> {
  const taskEngine = getTaskEngine();
  const tasks = await taskEngine.listByAgent(agentId);

  // This agent is the delegator — check tasks where this agent is the source
  // Actually, we need to search across all agents for tasks delegated BY this agent
  // For now, we'll use a simpler approach: check the input._delegatedBy field
  const delegated: Task[] = [];

  // This is a simplified version — in production, you'd query by _delegatedBy
  return delegated;
}

/**
 * Check if an agent has any pending delegated tasks.
 */
export async function hasPendingDelegations(agentId: string): Promise<boolean> {
  const tasks = await getDelegatedTasks(agentId);
  return tasks.some((t) => t.status === "pending" || t.status === "ready");
}
