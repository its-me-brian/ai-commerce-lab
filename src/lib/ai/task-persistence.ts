// Task Persistence
// Audit trail for task lifecycle events.
// FASE 28: Every status change, progress update, and event is recorded.

import { supabase } from "../database/supabase";
import { getTaskEngine, type TaskStatus }from "./task-engine";

export type TaskEventType =
  | "created"
  | "status_change"
  | "progress_update"
  | "error"
  | "retry"
  | "cancel"
  | "delegate"
  | "input_received"
  | "output_received";

export interface TaskEvent {
  id: string;
  task_id: string;
  event_type: TaskEventType;
  from_status: TaskStatus | null;
  to_status: TaskStatus | null;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TaskProgress {
  taskId: string;
  status: TaskStatus;
  progressPercent: number;
  currentStep: string;
  totalSteps: number;
  completedSteps: number;
  events: TaskEvent[];
}

/**
 * Task Persistence Manager
 * Records audit trail for all task lifecycle events.
 */
export class TaskPersistence {
  /**
   * Record a task event.
   */
  async recordEvent(
    taskId: string,
    eventType: TaskEventType,
    options?: {
      fromStatus?: TaskStatus;
      toStatus?: TaskStatus;
      message?: string;
      metadata?: Record<string, unknown>;
      workspaceId?: string;
    }
  ): Promise<TaskEvent | null> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("task_events")
      .insert({
        task_id: taskId,
        event_type: eventType,
        from_status: options?.fromStatus || null,
        to_status: options?.toStatus || null,
        message: options?.message || null,
        metadata: options?.metadata || {},
        created_at: now,
        workspace_id: options?.workspaceId || "",
      })
      .select()
      .single();

    if (error || !data) return null;
    return data as TaskEvent;
  }

  /**
   * Record a status change event.
   */
  async recordStatusChange(
    taskId: string,
    from: TaskStatus,
    to: TaskStatus,
    message?: string
  ): Promise<TaskEvent | null> {
    return this.recordEvent(taskId, "status_change", {
      fromStatus: from,
      toStatus: to,
      message: message || `Status changed from ${from} to ${to}`,
    });
  }

  /**
   * Record a progress update.
   */
  async recordProgress(
    taskId: string,
    progressPercent: number,
    currentStep: string,
    metadata?: Record<string, unknown>
  ): Promise<TaskEvent | null> {
    return this.recordEvent(taskId, "progress_update", {
      message: `${progressPercent}% — ${currentStep}`,
      metadata: {
        progressPercent,
        currentStep,
        ...metadata,
      },
    });
  }

  /**
   * Record an error event.
   */
  async recordError(
    taskId: string,
    errorMessage: string,
    metadata?: Record<string, unknown>
  ): Promise<TaskEvent | null> {
    return this.recordEvent(taskId, "error", {
      message: errorMessage,
      metadata,
    });
  }

  /**
   * Record a delegation event.
   */
  async recordDelegation(
    taskId: string,
    fromAgentId: string,
    toAgentId: string,
    reason?: string
  ): Promise<TaskEvent | null> {
    return this.recordEvent(taskId, "delegate", {
      message: reason || `Delegated from ${fromAgentId} to ${toAgentId}`,
      metadata: { fromAgentId, toAgentId },
    });
  }

  /**
   * Record a retry event.
   */
  async recordRetry(
    taskId: string,
    attemptNumber: number,
    reason?: string
  ): Promise<TaskEvent | null> {
    return this.recordEvent(taskId, "retry", {
      message: reason || `Retry attempt #${attemptNumber}`,
      metadata: { attemptNumber },
    });
  }

  /**
   * Get all events for a task.
   */
  async getEventsByTask(taskId: string): Promise<TaskEvent[]> {
    const { data, error } = await supabase
      .from("task_events")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at");

    if (error || !data) return [];
    return data as TaskEvent[];
  }

  /**
   * Get events for a task filtered by type.
   */
  async getEventsByType(
    taskId: string,
    eventType: TaskEventType
  ): Promise<TaskEvent[]> {
    const { data, error } = await supabase
      .from("task_events")
      .select("*")
      .eq("task_id", taskId)
      .eq("event_type", eventType)
      .order("created_at");

    if (error || !data) return [];
    return data as TaskEvent[];
  }

  /**
   * Get the latest event for a task.
   */
  async getLatestEvent(taskId: string): Promise<TaskEvent | null> {
    const { data, error } = await supabase
      .from("task_events")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as TaskEvent;
  }

  /**
   * Get task progress summary (aggregated from events).
   */
  async getTaskProgress(taskId: string, workspaceId: string): Promise<TaskProgress | null> {
    const taskEngine = getTaskEngine();
    const task = await taskEngine.getById(taskId, workspaceId);
    if (!task) return null;

    const events = await this.getEventsByTask(taskId);

    // Calculate progress from events
    let progressPercent = 0;
    let currentStep = "initialized";
    let totalSteps = 1;
    let completedSteps = 0;

    // Count progress_update events
    const progressEvents = events.filter((e) => e.event_type === "progress_update");
    if (progressEvents.length > 0) {
      const latest = progressEvents[progressEvents.length - 1];
      const meta = latest.metadata as Record<string, unknown>;
      progressPercent = (meta.progressPercent as number) || 0;
      currentStep = (meta.currentStep as string) || currentStep;
    }

    // Count completed tasks from status changes
    const statusEvents = events.filter((e) => e.event_type === "status_change");
    const completedStatuses = statusEvents.filter(
      (e) => e.to_status === "completed"
    );
    completedSteps = completedStatuses.length;

    // Estimate total steps from event count
    totalSteps = Math.max(completedSteps + 1, events.length);

    // Recalculate progress based on status
    if (task.status === "completed") {
      progressPercent = 100;
      completedSteps = totalSteps;
    } else if (task.status === "failed") {
      // Keep last known progress
    } else if (task.status === "running" && progressPercent === 0) {
      progressPercent = 10; // At least started
    }

    return {
      taskId,
      status: task.status,
      progressPercent,
      currentStep,
      totalSteps,
      completedSteps,
      events,
    };
  }

  /**
   * Get event summary statistics for a time range.
   */
  async getStats(
    workspaceId: string,
    startTime?: string,
    endTime?: string
  ): Promise<{
    total: number;
    byType: Record<TaskEventType, number>;
    errorRate: number;
    avgEventsPerTask: number;
  }> {
    let query = supabase
      .from("task_events")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (startTime) {
      query = query.gte("created_at", startTime);
    }
    if (endTime) {
      query = query.lte("created_at", endTime);
    }

    const { data, error } = await query;
    if (error || !data) {
      return {
        total: 0,
        byType: {
          created: 0,
          status_change: 0,
          progress_update: 0,
          error: 0,
          retry: 0,
          cancel: 0,
          delegate: 0,
          input_received: 0,
          output_received: 0,
        },
        errorRate: 0,
        avgEventsPerTask: 0,
      };
    }

    const events = data as TaskEvent[];
    const byType: Record<string, number> = {};
    const taskIds = new Set<string>();

    for (const event of events) {
      byType[event.event_type] = (byType[event.event_type] || 0) + 1;
      taskIds.add(event.task_id);
    }

    const errorCount = byType["error"] || 0;
    return {
      total: events.length,
      byType: byType as Record<TaskEventType, number>,
      errorRate: events.length > 0 ? errorCount / events.length : 0,
      avgEventsPerTask: taskIds.size > 0 ? events.length / taskIds.size : 0,
    };
  }

  /**
   * Clean up old events for a workspace (keep last N days).
   */
  async cleanupOldEvents(workspaceId: string, keepDays: number = 30): Promise<number> {
    const cutoff = new Date(
      Date.now() - keepDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("task_events")
      .delete()
      .eq("workspace_id", workspaceId)
      .lt("created_at", cutoff)
      .select("id");

    if (error || !data) return 0;
    return data.length;
  }
}

// Singleton
let instance: TaskPersistence | null = null;

export function getTaskPersistence(): TaskPersistence {
  if (!instance) {
    instance = new TaskPersistence();
  }
  return instance;
}
