// Agent Chat Service
// Orchestrates direct chat with an agent: create conversation, send message, get response.
// FASE 13: POST /api/agents/chat

import { bootstrap, getAgentRegistry } from "./bootstrap";
import { getRouter } from "./router";
import { getConversationEngine, type Conversation, type ConversationMessage } from "./conversation-engine";

export interface ChatInput {
  agentId: string;
  conversationId?: string;         // Continue existing conversation
  message: string;
  workspaceId?: string;
}

export interface ChatResult {
  conversation: Conversation;
  userMessage: ConversationMessage;
  assistantMessage: ConversationMessage;
}

/**
 * Send a message to an agent and get a response.
 * Creates a new conversation if none provided.
 */
export async function chatWithAgent(input: ChatInput): Promise<ChatResult> {
  await bootstrap();

  const registry = getAgentRegistry();
  const router = getRouter();
  const conversationEngine = getConversationEngine();

  // 1. Validate agent exists
  const agent = registry.getAgent(input.agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${input.agentId}`);
  }

  // 2. Get or create conversation
  let conversation: Conversation | null = null;

  if (input.conversationId) {
    conversation = await conversationEngine.getById(input.conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${input.conversationId}`);
    }
    if (conversation.status !== "active") {
      throw new Error(`Conversation ${input.conversationId} is not active`);
    }
  } else {
    conversation = await conversationEngine.create({
      agent_id: input.agentId,
      workspace_id: input.workspaceId,
    });
    if (!conversation) {
      throw new Error("Failed to create conversation");
    }
  }

  // 3. Add user message
  const userMessage = await conversationEngine.addMessage({
    conversation_id: conversation.id,
    role: "user",
    content: input.message,
  });

  if (!userMessage) {
    throw new Error("Failed to save user message");
  }

  // 4. Build context from conversation history
  const history = await conversationEngine.getLastMessages(conversation.id, 20);
  const messages = history.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  // 5. Call AI via router
  const startTime = Date.now();

  // Build system prompt from agent definition
  const agentDef = registry.getDefinition(input.agentId);
  const systemPrompt = agentDef
    ? `${agentDef.identity?.role ?? agentDef.name}: ${agentDef.mission}`
    : `You are ${agentDef?.name ?? input.agentId}`;

  try {
    const { result, log } = await router.generateForAgent(
      input.agentId,
      {
        prompt: input.message,
        systemPrompt,
        responseFormat: "text",
      }
    );

    // 6. Add assistant message
    const assistantMessage = await conversationEngine.addMessage({
      conversation_id: conversation.id,
      role: "assistant",
      content: result.content,
      provider: log.provider,
      model: log.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      duration_ms: result.durationMs,
    });

    if (!assistantMessage) {
      throw new Error("Failed to save assistant message");
    }

    return {
      conversation,
      userMessage,
      assistantMessage,
    };
  } catch (error) {
    // Add error message to conversation
    await conversationEngine.addMessage({
      conversation_id: conversation.id,
      role: "assistant",
      content: `Error: ${error instanceof Error ? error.message : String(error)}`,
      metadata: { error: true },
    });

    throw error;
  }
}
