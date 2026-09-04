// Task Engine v2
// Manages tasks with dependency tracking.
// FASE 14: Supports depends_on (task IDs) and parent_task_id (subtasks).

import { supabase } from "../database/supabase";

export type TaskStatus = "pending" | "ready" | "running" | "completed" | "failed" | "cancelled";

export interface Task {
  id: string;
  agent_id: string;
  status: TaskStatus;
  task_type: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  priority: number;
  error: string | null;
  depends_on: string[];
  parent_task_id: string | null;
  total_cost: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface TaskCreateInput {
  agent_id: string;
  task_type?: string;
  input: Record<string, unknown>;
  priority?: number;
  depends_on?: string[];
  parent_task_id?: string;
}

export interface TaskUpdateInput {
  status?: TaskStatus;
  output?: Record<string, unknown>;
  error?: string;
  total_cost?: number;
}

export class TaskEngine {
  /**
   * Create a new task.
   */
  async create(input: TaskCreateInput, workspaceId: string): Promise<Task | null> {
    if (!workspaceId) {
      throw new Error("workspaceId is required for task creation");
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("agent_tasks")
      .insert({
        agent_id: input.agent_id,
        task_type: input.task_type ?? "general",
        input: input.input,
        priority: input.priority ?? 5,
        depends_on: input.depends_on ?? [],
        parent_task_id: input.parent_task_id ?? null,
        status: "pending",
        created_at: now,
        workspace_id: workspaceId,
      })
      .select()
      .single();

    if (error || !data) return null;
    return data as Task;
  }

  /**
   * Get a task by ID. Requires workspaceId for tenant isolation.
   */
  async getById(id: string, workspaceId: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !data) return null;
    return data as Task;
  }

  /**
   * List all tasks for an agent within a workspace.
   */
  async listByAgent(agentId: string, workspaceId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("agent_id", agentId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as Task[];
  }

  /**
   * List tasks by status within a workspace.
   */
  async listByStatus(status: TaskStatus, workspaceId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("status", status)
      .eq("workspace_id", workspaceId)
      .order("priority");

    if (error || !data) return [];
    return data as Task[];
  }

  /**
   * Get subtasks of a parent task within a workspace.
   */
  async getSubtasks(parentTaskId: string, workspaceId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("parent_task_id", parentTaskId)
      .eq("workspace_id", workspaceId)
      .order("created_at");

    if (error || !data) return [];
    return data as Task[];
  }

  /**
   * Check if all dependencies of a task are completed.
   */
  async areDependenciesMet(taskId: string, workspaceId: string): Promise<boolean> {
    const task = await this.getById(taskId, workspaceId);
    if (!task) return false;
    if (task.depends_on.length === 0) return true;

    for (const depId of task.depends_on) {
      const dep = await this.getById(depId, workspaceId);
      if (!dep || dep.status !== "completed") return false;
    }

    return true;
  }

  /**
   * Get tasks that are ready to run (pending + all deps met) within a workspace.
   */
  async getReadyTasks(workspaceId: string): Promise<Task[]> {
    const pending = await this.listByStatus("pending", workspaceId);
    const ready: Task[] = [];

    for (const task of pending) {
      const depsMet = await this.areDependenciesMet(task.id, workspaceId);
      if (depsMet) {
        ready.push(task);
      }
    }

    return ready;
  }

  /**
   * Update a task. Requires workspaceId for tenant isolation.
   */
  async update(id: string, input: TaskUpdateInput, workspaceId: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from("agent_tasks")
      .update(input)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error || !data) return null;
    return data as Task;
  }

  /**
   * Mark a task as started.
   */
  async start(id: string, workspaceId: string): Promise<Task | null> {
    return this.update(id, {
      status: "running",
    }, workspaceId);
  }

  /**
   * Mark a task as completed with output.
   */
  async complete(id: string, output: Record<string, unknown>, workspaceId: string): Promise<Task | null> {
    return this.update(id, {
      status: "completed",
      output,
    }, workspaceId);
  }

  /**
   * Mark a task as failed with error.
   */
  async fail(id: string, error: string, workspaceId: string): Promise<Task | null> {
    return this.update(id, {
      status: "failed",
      error,
    }, workspaceId);
  }

  /**
   * Cancel a task.
   */
  async cancel(id: string, workspaceId: string): Promise<Task | null> {
    return this.update(id, {
      status: "cancelled",
    }, workspaceId);
  }

  /**
   * Delete a task. Requires workspaceId for tenant isolation.
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    const { error } = await supabase
      .from("agent_tasks")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    return !error;
  }
}

// Singleton
let instance: TaskEngine | null = null;

export function getTaskEngine(): TaskEngine {
  if (!instance) {
    instance = new TaskEngine();
  }
  return instance;
}
