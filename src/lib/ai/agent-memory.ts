// Agent Memory Service
// Persistent memory for agents across conversations.
// FASE 19: Store facts, preferences, patterns, and decisions.

import { supabase } from "../database/supabase";

export type MemoryType = "fact" | "preference" | "pattern" | "decision" | "context";

export interface AgentMemory {
  id: string;
  agent_id: string;
  workspace_id: string;
  memory_type: MemoryType;
  content: string;
  source: string | null;
  confidence: number;
  metadata: Record<string, unknown>;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryCreateInput {
  agent_id: string;
  workspace_id: string;
  memory_type: MemoryType;
  content: string;
  source?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
  expires_at?: string;
}

export interface MemorySearchOptions {
  agent_id: string;
  workspace_id: string;
  memory_type?: MemoryType;
  query?: string;                  // Text search in content
  min_confidence?: number;
  limit?: number;
}

export class AgentMemoryService {
  /**
   * Store a memory.
   */
  async store(input: MemoryCreateInput): Promise<AgentMemory | null> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("agent_memory")
      .insert({
        agent_id: input.agent_id,
        workspace_id: input.workspace_id,
        memory_type: input.memory_type,
        content: input.content,
        source: input.source || null,
        confidence: input.confidence ?? 1.0,
        metadata: input.metadata ?? {},
        expires_at: input.expires_at || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error || !data) return null;
    return data as AgentMemory;
  }

  /**
   * Get a memory by ID within a workspace.
   */
  async getById(id: string, workspaceId: string): Promise<AgentMemory | null> {
    const { data, error } = await supabase
      .from("agent_memory")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !data) return null;
    return data as AgentMemory;
  }

  /**
   * Search memories for an agent.
   */
  async search(options: MemorySearchOptions): Promise<AgentMemory[]> {
    let query = supabase
      .from("agent_memory")
      .select("*")
      .eq("agent_id", options.agent_id)
      .eq("workspace_id", options.workspace_id);

    if (options.memory_type) {
      query = query.eq("memory_type", options.memory_type);
    }

    if (options.min_confidence !== undefined) {
      query = query.gte("confidence", options.min_confidence);
    }

    // Filter out expired memories
    query = query.or("expires_at.is.null,expires_at.gt." + new Date().toISOString());

    query = query.order("created_at", { ascending: false });

    const limit = options.limit ?? 50;
    query = query.limit(limit);

    const { data, error } = await query;

    if (error || !data) return [];

    let memories = data as AgentMemory[];

    // Text search filter (Supabase doesn't support full-text search on JSONB easily)
    if (options.query) {
      const q = options.query.toLowerCase();
      memories = memories.filter((m) => m.content.toLowerCase().includes(q));
    }

    return memories;
  }

  /**
   * Get the most recent memories for an agent.
   */
  async getRecent(agentId: string, workspaceId: string, limit: number = 10): Promise<AgentMemory[]> {
    const { data, error } = await supabase
      .from("agent_memory")
      .select("*")
      .eq("agent_id", agentId)
      .eq("workspace_id", workspaceId)
      .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as AgentMemory[];
  }

  /**
   * Update a memory within a workspace.
   */
  async update(id: string, updates: Partial<Pick<AgentMemory, "content" | "confidence" | "metadata">>, workspaceId: string): Promise<AgentMemory | null> {
    const { data, error } = await supabase
      .from("agent_memory")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error || !data) return null;
    return data as AgentMemory;
  }

  /**
   * Delete a memory.
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    const { error } = await supabase
      .from("agent_memory")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    return !error;
  }

  /**
   * Delete all memories for an agent.
   */
  async deleteAllForAgent(agentId: string, workspaceId: string): Promise<boolean> {
    const { error } = await supabase
      .from("agent_memory")
      .delete()
      .eq("agent_id", agentId)
      .eq("workspace_id", workspaceId);

    return !error;
  }

  /**
   * Get memory count for an agent.
   */
  async count(agentId: string, workspaceId: string): Promise<number> {
    const { count } = await supabase
      .from("agent_memory")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .eq("workspace_id", workspaceId);

    return count || 0;
  }
}

// Singleton
let instance: AgentMemoryService | null = null;

export function getAgentMemoryService(): AgentMemoryService {
  if (!instance) {
    instance = new AgentMemoryService();
  }
  return instance;
}
