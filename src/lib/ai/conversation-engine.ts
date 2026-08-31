// Conversation Engine
// Manages multi-turn conversations between users and agents.
// FASE 12: conversations + conversation_messages tables.

import { supabase } from "../database/supabase";

export interface Conversation {
  id: string;
  agent_id: string;
  workspace_id: string | null;
  title: string | null;
  status: string;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
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
  agent_id: string;
  workspace_id?: string;
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
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        agent_id: input.agent_id,
        workspace_id: input.workspace_id || null,
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

    // Update conversation message count and last_message_at
    await supabase
      .from("conversations")
      .update({
        message_count: supabase.rpc ? 0 : 0, // Will use increment below
        last_message_at: now,
        updated_at: now,
      })
      .eq("id", input.conversation_id);

    // Increment message count using raw SQL approach
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
}

// Singleton
let instance: ConversationEngine | null = null;

export function getConversationEngine(): ConversationEngine {
  if (!instance) {
    instance = new ConversationEngine();
  }
  return instance;
}
