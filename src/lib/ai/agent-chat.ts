// Agent Chat Service
// Orchestrates direct chat with an agent: create conversation, send message, get response.
// FASE 13: POST /api/agents/chat
// FASE 18: Injects shared company context into prompts.
// FASE 27: CEO continuity — resolves references from conversation + task history.

import { bootstrap, getAgentRegistry } from "./bootstrap";
import { getRouter } from "./router";
import { getConversationEngine, type Conversation, type ConversationMessage } from "./conversation-engine";
import { getWorkspaceService } from "../workspaces/service";
import { getTaskEngine } from "./task-engine";
import { preprocessMessage, buildEnrichedPrompt, generateStatusResponse } from "./prompt-pipeline";
import { getStructuredLogger, getExecutionTracer } from "./observability";

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
 * Injects company context + task history for continuity.
 */
export async function chatWithAgent(input: ChatInput): Promise<ChatResult> {
  await bootstrap();

  const registry = getAgentRegistry();
  const router = getRouter();
  const conversationEngine = getConversationEngine();
  const workspaceService = getWorkspaceService();
  const taskEngine = getTaskEngine();
  const logger = getStructuredLogger();
  const tracer = getExecutionTracer();

  // Start trace for this chat request
  const traceId = tracer.startTrace(`chat:${input.agentId}`, {
    agentId: input.agentId,
    hasConversationId: !!input.conversationId,
    messageLength: input.message.length,
  });

  // 1. Validate agent exists
  const agent = registry.get(input.agentId);
  if (!agent) {
    tracer.endSpan(traceId, false, `Agent not found: ${input.agentId}`);
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
    // FASE 6: Reuse existing direct conversation instead of creating new one each time
    conversation = await conversationEngine.getOrCreateDirect(
      input.agentId,
      input.workspaceId,
    );
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

  // 5. Build system prompt with company context + agent definition
  const agentDef = registry.getDefinition(input.agentId);

  // FASE 18: Inject shared company context
  let companyContextSection = "";
  try {
    const companyContext = await workspaceService.buildCompanyContext(input.workspaceId || undefined);
    companyContextSection = workspaceService.formatContextForPrompt(companyContext);
  } catch {
    // Workspace may not exist yet — continue without context
  }

  // FASE 27: Agent continuity — include recent task results for reference resolution
  let taskHistorySection = "";
  try {
      const recentTasks = await taskEngine.listByAgent(input.agentId);
      const completedTasks = recentTasks
        .filter((t) => t.status === "completed" && t.output)
        .slice(0, 5);

      if (completedTasks.length > 0) {
        const lines = [`## Recent Task Results (for reference resolution)`];
        for (const task of completedTasks) {
          const outputSummary = typeof task.output === "object" && task.output !== null
            ? JSON.stringify(task.output).slice(0, 500)
            : String(task.output || "No output");
          lines.push(`- Task ${task.id.slice(0, 8)} (${task.task_type}): ${task.input.productName || task.input.goal || JSON.stringify(task.input).slice(0, 100)} → ${outputSummary.slice(0, 200)}`);
        }
        taskHistorySection = lines.join("\n");
      }
    } catch {
      // Continue without task history
    }

  // Build full system prompt — conversational mode with personality
  const systemPromptParts: string[] = [];

  if (agentDef) {
    // Identity
    systemPromptParts.push(
      `You are ${agentDef.identity.name}, ${agentDef.identity.role}.`,
      agentDef.identity.description,
      ``,
      `## Your Mission`,
      agentDef.mission,
    );

    // Personality
    if (agentDef.personality?.traits?.length > 0) {
      const traits = agentDef.personality.traits.map((t) =>
        t.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      ).join(", ");
      systemPromptParts.push(``, `Your personality: ${traits}.`);
    }

    if (agentDef.personality?.communicationStyle?.length > 0) {
      systemPromptParts.push(
        `Communication style: ${agentDef.personality.communicationStyle.join(", ")}.`
      );
    }

    // Expertise
    if (agentDef.expertise.length > 0) {
      systemPromptParts.push(
        ``,
        `## Your Expertise`,
        agentDef.expertise.map((e) => `- ${e.charAt(0).toUpperCase() + e.slice(1)}`).join(``),
      );
    }

    // Rules
    if (agentDef.rules.length > 0) {
      systemPromptParts.push(
        ``,
        `## Rules You Follow`,
        agentDef.rules.map((r) => `- ${r}`).join(``),
      );
    }

    // Conversational instruction
    systemPromptParts.push(
      ``,
      `## Conversation Mode`,
      `You are having a direct conversation with the user. Be helpful, concise, and stay in character.`,
      `Answer questions about your domain of expertise. If asked to perform a task, explain what you would do and ask for confirmation.`,
      `Use the company context below to provide informed answers.`,
    );
  } else {
    systemPromptParts.push(`You are ${input.agentId}. Be helpful and stay in character.`);
  }

  // FASE 18: Inject shared company context
  if (companyContextSection) {
    systemPromptParts.push(``, companyContextSection);
  }

  // FASE 27: CEO continuity — include recent task results for reference resolution
  if (taskHistorySection) {
    systemPromptParts.push(``, taskHistorySection);
  }

  // Inject conversation history into system prompt (providers don't support messages array)
  if (messages.length > 1) {
    const historyLines = messages.slice(0, -1).map((m) => {
      const role = m.role === "user" ? "User" : "Assistant";
      return `${role}: ${m.content}`;
    });
    systemPromptParts.push(
      ``,
      `## Conversation History`,
      historyLines.join(`\n`),
    );
  }

  const baseSystemPrompt = systemPromptParts.join("\n");

  // 6. §28, §29: MiniAI preprocessing — intent classification + entity extraction
  // KEY OPTIMIZATION: Fast-path for simple intents AND status queries (no LLM call needed)
  let enrichedSystemPrompt = baseSystemPrompt;
  try {
    const pipelineResult = await preprocessMessage({
      message: input.message,
      agentId: input.agentId,
      workspaceId: input.workspaceId,
      conversationHistory: messages,
    });

    // FAST-PATH: If MiniAI can answer without LLM, skip the LLM call
    if (pipelineResult.canAnswerWithoutLLM) {
      let responseText: string;

      // STATUS QUERY: Query task engine directly
      if (pipelineResult.isStatusQuery) {
        logger.log({
          severity: "info",
          component: "agent-chat",
          message: `Status query fast-path for agent ${input.agentId}`,
          traceId,
          context: { agentId: input.agentId, targetAgent: pipelineResult.statusQueryAgent },
        });

        try {
          const targetAgent = pipelineResult.statusQueryAgent;
          let tasks: Awaited<ReturnType<typeof taskEngine.listByAgent>> = [];

          if (targetAgent) {
            // Query specific agent's tasks
            tasks = await taskEngine.listByAgent(targetAgent);
          } else {
            // Query all agents' recent tasks
            const agentIds = ["product-hunter", "market-research", "supplier-research", "opportunity-scoring", "store-builder"];
            for (const agent of agentIds) {
              const agentTasks = await taskEngine.listByAgent(agent);
              tasks.push(...agentTasks);
            }
            // Sort by created_at descending, take most recent
            tasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            tasks = tasks.slice(0, 10);
          }

          responseText = generateStatusResponse(targetAgent ?? null, tasks, input.message);
        } catch {
          // Fallback if task engine fails
          responseText = "No pude consultar el estado de las tareas. ¿Podrías reformular tu pregunta?";
        }
      } else {
        // SIMPLE FAST-PATH: greeting, thanks, etc.
        responseText = pipelineResult.fastPathResponse!;

        logger.log({
          severity: "info",
          component: "agent-chat",
          message: `Fast-path response for agent ${input.agentId}`,
          traceId,
          context: { agentId: input.agentId, intent: pipelineResult.intent },
        });
      }

      // Add token savings info to response
      const tokenInfo = pipelineResult.tokenSavings
        ? ` [MiniAI: ${pipelineResult.tokenSavings.saved} tokens saved]`
        : "";

      // Save fast-path response to conversation
      const assistantMessage = await conversationEngine.addMessage({
        conversation_id: conversation.id,
        role: "assistant",
        content: responseText + tokenInfo,
        provider: "mini-ai-fast-path",
        model: "deterministic",
        input_tokens: 0,
        output_tokens: 0,
        duration_ms: 0,
      });

      if (!assistantMessage) {
        throw new Error("Failed to save fast-path response");
      }

      return {
        conversation,
        userMessage,
        assistantMessage,
      };
    }

    // Normal path: build optimized prompt for LLM
    enrichedSystemPrompt = buildEnrichedPrompt(
      baseSystemPrompt,
      pipelineResult,
      messages,
    );
  } catch {
    // Continue with base prompt if preprocessing fails
  }

  // 7. Call AI via router
  const startTime = Date.now();

  logger.log({
    severity: "info",
    component: "agent-chat",
    message: `LLM call starting for agent ${input.agentId}`,
    traceId,
    context: { agentId: input.agentId, messageLength: input.message.length },
  });

  try {
    const { result, log } = await router.generateForAgent(
      input.agentId,
      {
        prompt: input.message,
        systemPrompt: enrichedSystemPrompt,
        responseFormat: "text",
      }
    );

    const durationMs = Date.now() - startTime;

    logger.log({
      severity: "info",
      component: "agent-chat",
      message: `LLM call completed for agent ${input.agentId}`,
      traceId,
      durationMs,
      success: true,
      context: {
        agentId: input.agentId,
        provider: log.provider,
        model: log.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    });

    // 7. Add assistant message
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
    const durationMs = Date.now() - startTime;

    logger.log({
      severity: "error",
      component: "agent-chat",
      message: `LLM call failed for agent ${input.agentId}`,
      traceId,
      durationMs,
      success: false,
      context: {
        agentId: input.agentId,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    tracer.endSpan(traceId, false, error instanceof Error ? error.message : String(error));

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
