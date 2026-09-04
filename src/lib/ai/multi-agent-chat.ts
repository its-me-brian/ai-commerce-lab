// Multi-Agent Chat Service
// Orchestrates multi-agent fan-out in General Room.
// §8, §14: When no @mention, CEO coordinates and can delegate to other agents.
// Each agent's response is saved as a separate message.

import { bootstrap, getAgentRegistry } from "./bootstrap";
import { getRouter } from "./router";
import { getConversationEngine, type Conversation, type ConversationMessage } from "./conversation-engine";
import { getWorkspaceService } from "../workspaces/service";
import type { AgentDefinition } from "../agents/core/types-agent-definition";
import { preprocessMessage, buildEnrichedPrompt } from "./prompt-pipeline";

export interface MultiAgentChatInput {
  message: string;
  conversationId: string;
  workspaceId?: string;
  /** If @mentioned, only this agent responds. null = fan-out mode. */
  targetAgentId?: string;
}

export interface AgentResponse {
  agentId: string;
  message: ConversationMessage;
}

export interface MultiAgentChatResult {
  conversation: Conversation;
  userMessage: ConversationMessage;
  agentResponses: AgentResponse[];
}

/**
 * Send a message to one or more agents in a room conversation.
 * - If targetAgentId is provided: only that agent responds (§14 @mention)
 * - If no targetAgentId: CEO responds first, then can delegate to relevant agents (§8 fan-out)
 */
export async function multiAgentChat(input: MultiAgentChatInput): Promise<MultiAgentChatResult> {
  await bootstrap();

  const registry = getAgentRegistry();
  const router = getRouter();
  const conversationEngine = getConversationEngine();
  const workspaceService = getWorkspaceService();

  // 1. Validate conversation exists
  const conversation = await conversationEngine.getById(input.conversationId);
  if (!conversation) {
    throw new Error(`Conversation not found: ${input.conversationId}`);
  }
  if (conversation.status !== "active") {
    throw new Error(`Conversation ${input.conversationId} is not active`);
  }

  // 2. Add user message
  const userMessage = await conversationEngine.addMessage({
    conversation_id: input.conversationId,
    role: "user",
    content: input.message,
  });

  if (!userMessage) {
    throw new Error("Failed to save user message");
  }

  // 3. Build company context for all agents
  let companyContextSection = "";
  try {
    const companyContext = await workspaceService.buildCompanyContext(input.workspaceId || undefined);
    companyContextSection = workspaceService.formatContextForPrompt(companyContext);
  } catch {
    // Continue without context
  }

  // 4. Get conversation history
  const history = await conversationEngine.getLastMessages(input.conversationId, 20);
  const historyLines = history.map((m) => {
    const role = m.role === "user" ? "User" : m.metadata?.agent_id
      ? `Agent(${m.metadata.agent_id})`
      : "Assistant";
    return `${role}: ${m.content}`;
  });

  const agentResponses: AgentResponse[] = [];

  if (input.targetAgentId) {
    // §14: @mention — only the mentioned agent responds
    const response = await invokeAgent(
      input.targetAgentId,
      input.message,
      historyLines,
      companyContextSection,
      input.conversationId,
      conversationEngine,
      registry,
      router,
      input.workspaceId,
    );
    agentResponses.push(response);
  } else {
    // §8: Fan-out mode — CEO coordinates, can delegate to other agents

    // Step A: CEO analyzes the message and decides who should respond
    const coordinatorId = "ceo";
    const coordinatorDef = registry.getDefinition(coordinatorId);

    // Get list of available agent IDs
    const availableAgentIds = registry.listEnabled().map((m) => m.id).join(", ");

    const coordinatorPrompt = buildAgentSystemPrompt(
      coordinatorId,
      coordinatorDef,
      historyLines,
      companyContextSection,
      `You are coordinating a multi-agent response. Analyze the user's message and determine which agents should respond.

Available agents: ${availableAgentIds}

If the message is ONLY relevant to you (CEO), respond normally.
If other agents should contribute, output a JSON block at the END of your response:
{"delegate_to": ["agent_id_1", "agent_id_2"]}

Only delegate to agents whose expertise is directly relevant. Do NOT delegate for simple questions you can answer yourself.

Examples of when to delegate:
- User asks about products → delegate to "inventory_manager"
- User asks about marketing → delegate to "marketing_manager"
- User asks about finances → delegate to "finance_manager"
- Simple greeting or general question → CEO handles alone

Examples of when NOT to delegate:
- "hello" → CEO handles
- "what's our revenue?" → CEO handles (financial overview)
- "create a campaign for ProductX" → delegate to marketing_manager`,
    );

    const { result: coordinatorResult, log: coordinatorLog } = await router.generateForAgent(
      coordinatorId,
      {
        prompt: input.message,
        systemPrompt: coordinatorPrompt,
        responseFormat: "text",
      },
      { workspaceId: input.workspaceId || "" }
    );

    // Save CEO response
    const coordinatorMessage = await conversationEngine.addMessage({
      conversation_id: input.conversationId,
      role: "assistant",
      content: coordinatorResult.content,
      provider: coordinatorLog.provider,
      model: coordinatorLog.model,
      input_tokens: coordinatorResult.inputTokens,
      output_tokens: coordinatorResult.outputTokens,
      duration_ms: coordinatorResult.durationMs,
      metadata: { agent_id: coordinatorId },
    });

    if (!coordinatorMessage) {
      throw new Error("Failed to save CEO message");
    }

    agentResponses.push({ agentId: coordinatorId, message: coordinatorMessage });

    // Step B: Check if CEO requested delegation
    const delegationMatch = coordinatorResult.content.match(/\{"delegate_to":\s*\[([^\]]*)\]\}/);
    if (delegationMatch) {
      const agentIds = delegationMatch[1]
        .split(",")
        .map((id) => id.trim().replace(/"/g, ""))
        .filter((id) => id && id !== coordinatorId);

      // Invoke each delegated agent
      for (const agentId of agentIds) {
        if (!registry.get(agentId)) continue; // Skip unknown agents

        try {
          const response = await invokeAgent(
            agentId,
            input.message,
            [...historyLines, `CEO: ${coordinatorResult.content}`],
            companyContextSection,
            input.conversationId,
            conversationEngine,
            registry,
            router,
            input.workspaceId,
          );
          agentResponses.push(response);
        } catch {
          // Log error but continue with other agents
          console.error(`Agent ${agentId} failed in fan-out:`, agentId);
        }
      }
    }
  }

  return {
    conversation,
    userMessage,
    agentResponses,
  };
}

/**
 * Invoke a single agent and save its response.
 */
async function invokeAgent(
  agentId: string,
  userMessage: string,
  historyLines: string[],
  companyContextSection: string,
  conversationId: string,
  conversationEngine: ReturnType<typeof getConversationEngine>,
  registry: ReturnType<typeof getAgentRegistry>,
  router: ReturnType<typeof getRouter>,
  workspaceId?: string,
): Promise<AgentResponse> {
  const agentDef = registry.getDefinition(agentId);

  const baseSystemPrompt = buildAgentSystemPrompt(
    agentId,
    agentDef,
    historyLines,
    companyContextSection,
  );

  // §28, §29: MiniAI preprocessing — enrich prompt with intent/entities
  let systemPrompt = baseSystemPrompt;
  try {
    const pipelineResult = await preprocessMessage({
      message: userMessage,
      agentId,
    });
    systemPrompt = buildEnrichedPrompt(baseSystemPrompt, pipelineResult);
  } catch {
    // Continue with base prompt if preprocessing fails
  }

  const { result, log } = await router.generateForAgent(
    agentId,
    {
      prompt: userMessage,
      systemPrompt,
      responseFormat: "text",
    },
    { workspaceId: workspaceId || "" }
  );

  const message = await conversationEngine.addMessage({
    conversation_id: conversationId,
    role: "assistant",
    content: result.content,
    provider: log.provider,
    model: log.model,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    duration_ms: result.durationMs,
    metadata: { agent_id: agentId },
  });

  if (!message) {
    throw new Error(`Failed to save message for agent ${agentId}`);
  }

  return { agentId, message };
}

/**
 * Build a system prompt for an agent in room mode.
 */
function buildAgentSystemPrompt(
  agentId: string,
  agentDef: AgentDefinition | undefined,
  historyLines: string[],
  companyContextSection: string,
  additionalInstructions?: string,
): string {
  const parts: string[] = [];

  if (agentDef) {
    parts.push(
      `You are ${agentDef.identity.name}, ${agentDef.identity.role}.`,
      agentDef.identity.description,
      ``,
      `## Your Mission`,
      agentDef.mission,
    );

    if (agentDef.personality?.traits?.length > 0) {
      const traits = agentDef.personality.traits.map((t: string) =>
        t.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      ).join(", ");
      parts.push(``, `Your personality: ${traits}.`);
    }

    if (agentDef.personality?.communicationStyle?.length > 0) {
      parts.push(`Communication style: ${agentDef.personality.communicationStyle.join(", ")}.`);
    }

    if (agentDef.expertise.length > 0) {
      parts.push(
        ``,
        `## Your Expertise`,
        agentDef.expertise.map((e: string) => `- ${e.charAt(0).toUpperCase() + e.slice(1)}`).join(``),
      );
    }

    if (agentDef.rules.length > 0) {
      parts.push(
        ``,
        `## Rules You Follow`,
        agentDef.rules.map((r: string) => `- ${r}`).join(``),
      );
    }

    parts.push(
      ``,
      `## Conversation Mode`,
      `You are in a multi-agent workspace chat. Other agents may also respond to this message.`,
      `Be helpful, concise, and stay in character. Respond only within your area of expertise.`,
    );
  } else {
    parts.push(`You are ${agentId}. Be helpful and stay in character.`);
  }

  if (additionalInstructions) {
    parts.push(``, additionalInstructions);
  }

  if (companyContextSection) {
    parts.push(``, companyContextSection);
  }

  if (historyLines.length > 1) {
    parts.push(
      ``,
      `## Conversation History`,
      historyLines.join(`\n`),
    );
  }

  return parts.join("\n");
}
