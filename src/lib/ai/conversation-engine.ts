// Conversation Engine
// Manages multi-turn conversations between users and agents.
// FASE 12: conversations + conversation_messages tables.

import { supabase } from "../database/supabase";

export interface Conversation {
  id: string;
  agent_id: string | null;           // null for room conversations
  workspace_id: string | null;
  conversation_type: string;          // 'direct' | 'room'
  title: string | null;
  status: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  agent_id: string;
  role: string;                      // 'owner' | 'participant' | 'observer'
  joined_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  duration_ms: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ConversationCreateInput {
  agent_id?: string;                  // required for direct, optional for room
  workspace_id?: string;
  conversation_type?: string;         // 'direct' (default) | 'room'
  title?: string;
}

export interface MessageCreateInput {
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

export class ConversationEngine {
  /**
   * Create a new conversation.
   */
  async create(input: ConversationCreateInput): Promise<Conversation | null> {
    const now = new Date().toISOString();
    const type = input.conversation_type || "direct";
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        agent_id: input.agent_id || null,
        workspace_id: input.workspace_id || null,
        conversation_type: type,
        title: input.title || null,
        status: "active",
        message_count: 0,
        last_message_at: null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error || !data) return null;
    return data as Conversation;
  }

  /**
   * Get a conversation by ID.
   */
  async getById(id: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as Conversation;
  }

  /**
   * List all conversations for an agent.
   */
  async listByAgent(agentId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("agent_id", agentId)
      .order("last_message_at", { ascending: false });

    if (error || !data) return [];
    return data as Conversation[];
  }

  /**
   * List active conversations.
   */
  async listActive(): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("status", "active")
      .order("last_message_at", { ascending: false });

    if (error || !data) return [];
    return data as Conversation[];
  }

  /**
   * Archive a conversation.
   */
  async archive(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("conversations")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", id);

    return !error;
  }

  /**
   * Delete a conversation (soft delete).
   */
  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("conversations")
      .update({ status: "deleted", updated_at: new Date().toISOString() })
      .eq("id", id);

    return !error;
  }

  /**
   * Add a message to a conversation.
   */
  async addMessage(input: MessageCreateInput): Promise<ConversationMessage | null> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("conversation_messages")
      .insert({
        conversation_id: input.conversation_id,
        role: input.role,
        content: input.content,
        provider: input.provider || null,
        model: input.model || null,
        input_tokens: input.input_tokens ?? 0,
        output_tokens: input.output_tokens ?? 0,
        duration_ms: input.duration_ms ?? 0,
        metadata: input.metadata ?? {},
        created_at: now,
      })
      .select()
      .single();

    if (error || !data) return null;

    // Update last_message_at and updated_at
    await supabase
      .from("conversations")
      .update({
        last_message_at: now,
        updated_at: now,
      })
      .eq("id", input.conversation_id);

    // Increment message_count atomically (read current → add 1 → write back)
    const conv = await this.getById(input.conversation_id);
    if (conv) {
      await supabase
        .from("conversations")
        .update({ message_count: conv.message_count + 1 })
        .eq("id", input.conversation_id);
    }

    return data as ConversationMessage;
  }

  /**
   * Get all messages for a conversation, ordered by creation time.
   */
  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const { data, error } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at");

    if (error || !data) return [];
    return data as ConversationMessage[];
  }

  /**
   * Get the last N messages for a conversation (for context window).
   */
  async getLastMessages(
    conversationId: string,
    limit: number = 10
  ): Promise<ConversationMessage[]> {
    const { data, error } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return (data as ConversationMessage[]).reverse();
  }

  /**
   * Get token usage summary for a conversation.
   */
  async getTokenUsage(
    conversationId: string
  ): Promise<{ inputTokens: number; outputTokens: number; totalMessages: number }> {
    const messages = await this.getMessages(conversationId);

    let inputTokens = 0;
    let outputTokens = 0;

    for (const msg of messages) {
      inputTokens += msg.input_tokens;
      outputTokens += msg.output_tokens;
    }

    return {
      inputTokens,
      outputTokens,
      totalMessages: messages.length,
    };
  }

  // ─── PARTICIPANTS ─────────────────────────────────────────────

  /**
   * Add an agent as participant to a conversation.
   */
  async addParticipant(
    conversationId: string,
    agentId: string,
    role: string = "participant"
  ): Promise<ConversationParticipant | null> {
    const { data, error } = await supabase
      .from("conversation_participants")
      .upsert(
        {
          conversation_id: conversationId,
          agent_id: agentId,
          role,
        },
        { onConflict: "conversation_id,agent_id" }
      )
      .select()
      .single();

    if (error || !data) return null;
    return data as ConversationParticipant;
  }

  /**
   * Get all participants in a conversation.
   */
  async getParticipants(conversationId: string): Promise<ConversationParticipant[]> {
    const { data, error } = await supabase
      .from("conversation_participants")
      .select("*")
      .eq("conversation_id", conversationId);

    if (error || !data) return [];
    return data as ConversationParticipant[];
  }

  /**
   * Remove a participant from a conversation.
   */
  async removeParticipant(conversationId: string, agentId: string): Promise<boolean> {
    const { error } = await supabase
      .from("conversation_participants")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("agent_id", agentId);

    return !error;
  }

  // ─── DIRECT CONVERSATION HELPERS ──────────────────────────────

  /**
   * Get or create a direct conversation between workspace and agent.
   * Returns existing active conversation if found, otherwise creates new one.
   */
  async getOrCreateDirect(
    agentId: string,
    workspaceId?: string
  ): Promise<Conversation | null> {
    // Look for existing active direct conversation for this agent
    const existing = await supabase
      .from("conversations")
      .select("*")
      .eq("agent_id", agentId)
      .eq("conversation_type", "direct")
      .eq("status", "active")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.data) return existing.data as Conversation;

    // Create new direct conversation
    return this.create({
      agent_id: agentId,
      workspace_id: workspaceId,
      conversation_type: "direct",
    });
  }

  // ─── ROOM HELPERS ─────────────────────────────────────────────

  /**
   * Get or create a room conversation for a workspace.
   * Rooms are shared multi-agent conversations.
   */
  async getOrCreateRoom(
    workspaceId: string,
    title?: string
  ): Promise<Conversation | null> {
    // Look for existing active room in this workspace
    const existing = await supabase
      .from("conversations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("conversation_type", "room")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (existing.data) return existing.data as Conversation;

    // Create new room conversation
    return this.create({
      workspace_id: workspaceId,
      conversation_type: "room",
      title: title || "Company Room",
    });
  }

  /**
   * List all conversations for a workspace (both rooms and direct).
   */
  async listByWorkspace(workspaceId: string): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("last_message_at", { ascending: false });

    if (error || !data) return [];
    return data as Conversation[];
  }
}

// Singleton
let instance: ConversationEngine | null = null;

export function getConversationEngine(): ConversationEngine {
  if (!instance) {
    instance = new ConversationEngine();
  }
  return instance;
}
