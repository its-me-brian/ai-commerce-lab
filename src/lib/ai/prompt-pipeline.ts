// Prompt Pipeline
// §28, §29: Connects MiniAI preprocessing to LLM prompt building.
// Flow: User message → MiniAI (intent/entities) → Fast-path check → Context selection → Prompt Builder → LLM
//
// TOKEN OPTIMIZATION: MiniAI filters messages before LLM call.
// Simple intents (greetings, thanks) get canned responses — no LLM call.
// Complex intents get compressed prompts with only relevant sections.

import { getMiniAIEngine } from "./mini-ai/engine";
import { getMiniAIRegistry } from "./mini-ai/registry";
import { countTokens } from "./token-counter";

export interface PipelineInput {
  message: string;
  agentId: string;
  workspaceId?: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface PipelineResult {
  /** The enriched system prompt to send to the LLM */
  systemPrompt: string;
  /** The original user message (unchanged) */
  userMessage: string;
  /** Detected intent from MiniAI classification */
  intent?: string;
  /** Intent confidence score */
  intentConfidence?: number;
  /** Extracted entities from the message */
  entities?: Record<string, unknown>;
  /** Whether MiniAI preprocessing was used */
  miniAiUsed: boolean;
  /** Whether this message can be answered without LLM (fast-path) */
  canAnswerWithoutLLM: boolean;
  /** Pre-computed response for fast-path (no LLM call needed) */
  fastPathResponse?: string;
  /** Whether this is a status query */
  isStatusQuery?: boolean;
  /** Agent ID extracted from status query */
  statusQueryAgent?: string | null;
  /** Token savings info */
  tokenSavings?: {
    originalPromptTokens: number;
    optimizedPromptTokens: number;
    saved: number;
  };
  /** Any warnings from the pipeline */
  warnings: string[];
}

// Intent categories for the classifier
const INTENT_CATEGORIES = [
  "greeting",
  "question",
  "task_request",
  "product_inquiry",
  "marketing_request",
  "financial_query",
  "inventory_check",
  "analysis_request",
  "creative_request",
  "complaint",
  "feedback",
  "status_query",
  "general",
];

/**
 * Intents that can be answered WITHOUT calling the LLM.
 * These are simple patterns where MiniAI can generate a response directly.
 */
const FAST_PATH_INTENTS = new Set(["greeting", "acknowledgment", "thanks", "goodbye"]);

/**
 * Simple greeting patterns for fast-path detection.
 */
const GREETING_PATTERNS = [
  /^(hi|hello|hey|hola|buenas|que tal|que onda|como va|whats up|sup)\b/i,
  /^(good\s*(morning|afternoon|evening|night))\b/i,
  /^(buenos?\s*(dias|tardes|noches))\b/i,
];

const THANKS_PATTERNS = [
  /^(thanks|thank you|gracias|thx|ty|vale|perfecto|genial|great|awesome)\b/i,
  /^(ok|oki|dale|bien|correcto|exacto)\b/i,
];

const GOODBYE_PATTERNS = [
  /^(bye|adios|chau|nos vemos|see you|later|hasta luego)\b/i,
];

/**
 * Status query patterns — detect questions about task/agent progress.
 * These can be answered by querying the task engine directly.
 */
const STATUS_QUERY_PATTERNS = [
  // Spanish
  /como\s+(va|va\s+el|esta\s+el|avan[zs]a|va\s+todo)/i,
  /que\s+paso\s+con/i,
  /encontr[oó]\s+(el|lo|algo)/i,
  /ya\s+(esta|encontr[oó]|busc[oó]|gener[oó]|termin[oó]|complet[oó])/i,
  /hay\s+(resultado|avance|novedad)/i,
  /cuanto\s+(va|lleva|falta)/i,
  /el\s+estado\s+de/i,
  /como\s+voy\s+con/i,
  /del\s+producto/,
  /del\s+tema/,
  /del\s+hunter/,
  /del\s+market/,
  /de\s+las?\s+copys?/i,
  /de\s+los?\s+proveedores?/i,
  /del\s+supplier/,
  // English
  /how('s|\s+is)\s+(it\s+going|the\s+status)/i,
  /what('s|\s+is)\s+the\s+status/i,
  /any\s+(update|progress|news|result)/i,
  /did\s+(we|you|the)\s+(find|get|finish|complete)/i,
  /how\s+is\s+(the\s+)?(product|hunter|market|supplier|copys?)/i,
];

/**
 * Status keywords for quick intent detection.
 */
const STATUS_KEYWORDS = [
  "producto", "product", "hunter", "market", "marketing",
  "supplier", "supplier-research", "proveedores",
  "copys", "copies", "copys", "avance", "progreso",
  "resultado", "result", "estado", "status", "tema",
  "investigacion", "research", "oportunidad", "opportunity",
  "scoring", "catalog", "tienda", "store",
];

/**
 * Agent aliases — map common names to agent IDs.
 */
const AGENT_ALIASES: Record<string, string> = {
  "hunter": "product-hunter",
  "producthunter": "product-hunter",
  "product hunter": "product-hunter",
  "product-hunter": "product-hunter",
  "market": "market-research",
  "marketing": "market-research",
  "marketresearch": "market-research",
  "market-research": "market-research",
  "supplier": "supplier-research",
  "supplierresearch": "supplier-research",
  "supplier-research": "supplier-research",
  "proveedores": "supplier-research",
  "opportunity": "opportunity-scoring",
  "scoring": "opportunity-scoring",
  "opportunity-scoring": "opportunity-scoring",
  "ceo": "ceo",
  "store-builder": "store-builder",
  "storebuilder": "store-builder",
  "tienda": "store-builder",
};

/**
 * Detect if a message is a status query.
 */
function isStatusQuery(message: string): boolean {
  return STATUS_QUERY_PATTERNS.some(p => p.test(message));
}

/**
 * Extract agent name from message.
 */
function extractAgentFromMessage(message: string): string | null {
  const lower = message.toLowerCase();

  // Check each alias
  for (const [alias, agentId] of Object.entries(AGENT_ALIASES)) {
    if (lower.includes(alias)) {
      return agentId;
    }
  }

  // Check for "el/la [agent]" pattern
  const match = lower.match(/(?:el|la|los|las)\s+([\w-]+)/);
  if (match) {
    const candidate = match[1];
    return AGENT_ALIASES[candidate] || null;
  }

  return null;
}

/**
 * Fast-path responses by intent and agent.
 * These are generated WITHOUT calling the LLM — zero token cost.
 */
const FAST_PATH_RESPONSES: Record<string, Record<string, string>> = {
  greeting: {
    default: "¡Hola! ¿En qué puedo ayudarte?",
    ceo: "¡Hola! Soy el CEO. ¿Qué necesitas?",
    "store-builder": "¡Hola! Estoy listo para construir tu tienda. ¿Qué producto tenés en mente?",
    marketing: "¡Hola! ¿Necesitás ayuda con marketing?",
    finance: "¡Hola! ¿Tenés alguna consulta financiera?",
    "supplier-research": "¡Hola! ¿Buscás proveedores?",
    "market-research": "¡Hola! ¿Querés que investigue el mercado?",
  },
  acknowledgment: {
    default: "¡Perfecto! Seguimos cuando quieras.",
  },
  thanks: {
    default: "¡De nada! ¿En qué más puedo ayudarte?",
  },
  goodbye: {
    default: "¡Hasta luego! Que tengas un buen día.",
  },
};

/**
 * Generate a status response from task data.
 * This is the KEY function that replaces LLM calls for status queries.
 * Exported for use in agent-chat.ts fast-path.
 */
export function generateStatusResponse(
  agentId: string | null,
  tasks: Array<{
    status: string;
    task_type: string;
    input: Record<string, unknown>;
    output: Record<string, unknown> | null;
    created_at: string;
    completed_at: string | null;
    error: string | null;
  }>,
  message: string,
): string {
  // If we have tasks, summarize them
  if (tasks.length === 0) {
    const agentName = agentId ? getAgentDisplayName(agentId) : "el agente";
    return `No hay tareas registradas para ${agentName}. ¿Querés que inicie una nueva tarea?`;
  }

  // Group tasks by status
  const running = tasks.filter(t => t.status === "running");
  const completed = tasks.filter(t => t.status === "completed");
  const pending = tasks.filter(t => t.status === "pending" || t.status === "ready");
  const failed = tasks.filter(t => t.status === "failed");

  const parts: string[] = [];
  const agentName = agentId ? getAgentDisplayName(agentId) : "Los agentes";

  // Running tasks
  if (running.length > 0) {
    parts.push(`🔄 **En progreso:** ${running.length} tarea(s)`);
    for (const task of running.slice(0, 3)) {
      const productName = extractProductName(task.input);
      const timeAgo = getTimeAgo(task.created_at);
      parts.push(`  - ${task.task_type}${productName ? `: ${productName}` : ""} (${timeAgo})`);
    }
  }

  // Completed tasks
  if (completed.length > 0) {
    parts.push(`✅ **Completadas:** ${completed.length} tarea(s)`);
    for (const task of completed.slice(0, 3)) {
      const productName = extractProductName(task.input);
      const summary = summarizeOutput(task.output);
      parts.push(`  - ${task.task_type}${productName ? `: ${productName}` : ""} → ${summary}`);
    }
  }

  // Pending tasks
  if (pending.length > 0) {
    parts.push(`⏳ **Pendientes:** ${pending.length} tarea(s)`);
  }

  // Failed tasks
  if (failed.length > 0) {
    parts.push(`❌ **Fallidas:** ${failed.length} tarea(s)`);
    for (const task of failed.slice(0, 2)) {
      parts.push(`  - ${task.task_type}: ${task.error || "Error desconocido"}`);
    }
  }

  if (parts.length === 0) {
    return `No hay tareas relevantes para ${agentName}. ¿Querés que inicie una nueva tarea?`;
  }

  return `**Estado de ${agentName}:**\n\n${parts.join("\n")}`;
}

/**
 * Get display name for an agent.
 */
function getAgentDisplayName(agentId: string): string {
  const names: Record<string, string> = {
    "ceo": "el CEO",
    "product-hunter": "el Product Hunter",
    "market-research": "Market Research",
    "supplier-research": "Supplier Research",
    "opportunity-scoring": "Opportunity Scoring",
    "store-builder": "Store Builder",
    "marketing": "Marketing",
    "finance": "Finance",
    "analytics": "Analytics",
  };
  return names[agentId] || agentId;
}

/**
 * Extract product name from task input.
 */
function extractProductName(input: Record<string, unknown>): string | null {
  if (typeof input.productName === "string") return input.productName;
  if (typeof input.product === "string") return input.product;
  if (typeof input.goal === "string") return input.goal;
  if (typeof input.name === "string") return input.name;
  return null;
}

/**
 * Summarize task output for display.
 */
function summarizeOutput(output: Record<string, unknown> | null): string {
  if (!output) return "Sin resultados";

  // Try to extract key info
  if (typeof output.summary === "string") return output.summary.slice(0, 100);
  if (typeof output.result === "string") return output.result.slice(0, 100);
  if (typeof output.products === "object" && Array.isArray(output.products)) {
    return `${output.products.length} productos encontrados`;
  }
  if (typeof output.copies === "object" && Array.isArray(output.copies)) {
    return `${output.copies.length} copys generados`;
  }
  if (typeof output.suppliers === "object" && Array.isArray(output.suppliers)) {
    return `${output.suppliers.length} proveedores encontrados`;
  }

  // Fallback: first 100 chars of JSON
  const json = JSON.stringify(output);
  return json.length > 100 ? json.slice(0, 100) + "..." : json;
}

/**
 * Get relative time string.
 */
function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "ahora mismo";
  if (diffMin < 60) return `hace ${diffMin} min`;
  if (diffHr < 24) return `hace ${diffHr}h`;
  return `hace ${diffDay}d`;
}

/**
 * Estimate token count from text.
 * Uses the real token counter from token-counter.ts.
 */
function estimateTokens(text: string): number {
  return countTokens(text);
}

/**
 * Generate a fast-path response for simple intents.
 * Returns null if the intent needs LLM processing.
 */
function generateFastPathResponse(
  intent: string,
  message: string,
  agentId: string,
): string | null {
  // Check greeting patterns
  if (GREETING_PATTERNS.some(p => p.test(message.trim()))) {
    const responses = FAST_PATH_RESPONSES.greeting;
    return responses[agentId] || responses.default;
  }

  // Check thanks patterns
  if (THANKS_PATTERNS.some(p => p.test(message.trim()))) {
    const responses = FAST_PATH_RESPONSES.thanks;
    return responses[agentId] || responses.default;
  }

  // Check goodbye patterns
  if (GOODBYE_PATTERNS.some(p => p.test(message.trim()))) {
    const responses = FAST_PATH_RESPONSES.goodbye;
    return responses[agentId] || responses.default;
  }

  // Check known fast-path intents
  if (FAST_PATH_INTENTS.has(intent)) {
    const intentResponses = FAST_PATH_RESPONSES[intent];
    if (intentResponses) {
      return intentResponses[agentId] || intentResponses.default;
    }
  }

  return null; // Needs LLM
}

/**
 * Detect status queries and extract agent info.
 * Returns null if not a status query.
 */
function detectStatusQuery(message: string): { agentId: string | null } | null {
  if (!isStatusQuery(message)) return null;
  const agentId = extractAgentFromMessage(message);
  return { agentId };
}

/**
 * Compress conversation history for token savings.
 * Keeps last N messages verbatim, summarizes older ones.
 */
function compressHistory(
  history: Array<{ role: string; content: string }>,
  maxRecent: number = 5,
): string {
  if (history.length <= maxRecent) {
    // All messages fit — use as-is
    return history.map(m => {
      const role = m.role === "user" ? "User" : "Assistant";
      return `${role}: ${m.content}`;
    }).join("\n");
  }

  // Split: recent (verbatim) + old (summarized)
  const oldMessages = history.slice(0, -maxRecent);
  const recentMessages = history.slice(-maxRecent);

  // Summarize old messages: extract key topics
  const oldTopics = new Set<string>();
  for (const msg of oldMessages) {
    if (msg.role === "user") {
      // Extract first sentence or first 50 chars as topic
      const firstSentence = msg.content.split(/[.!?]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 5) {
        oldTopics.add(firstSentence.slice(0, 80));
      }
    }
  }

  const parts: string[] = [];

  if (oldTopics.size > 0) {
    parts.push(`[Earlier topics: ${Array.from(oldTopics).slice(0, 3).join("; ")}]`);
  }

  // Recent messages verbatim
  for (const msg of recentMessages) {
    const role = msg.role === "user" ? "User" : "Assistant";
    parts.push(`${role}: ${msg.content}`);
  }

  return parts.join("\n");
}

/**
 * Prune system prompt sections based on detected intent.
 * Removes irrelevant sections to save tokens.
 */
function prunePromptByIntent(
  basePrompt: string,
  intent: string,
  entities: Record<string, unknown>,
): string {
  const lines = basePrompt.split("\n");
  const pruned: string[] = [];

  let skipSection = false;
  let currentSection = "";

  for (const line of lines) {
    // Detect section headers
    if (line.startsWith("## ")) {
      currentSection = line.toLowerCase();
      skipSection = false;

      // Skip sections irrelevant to this intent
      if (intent === "greeting" || intent === "acknowledgment" || intent === "thanks") {
        // For simple intents, skip heavy sections
        if (
          currentSection.includes("task results") ||
          currentSection.includes("company context") ||
          currentSection.includes("conversation history") ||
          currentSection.includes("expertise") ||
          currentSection.includes("rules")
        ) {
          skipSection = true;
          continue;
        }
      }

      if (intent === "question" || intent === "general") {
        // For questions, skip task history
        if (currentSection.includes("task results")) {
          skipSection = true;
          continue;
        }
      }

      if (intent === "product_inquiry") {
        // For product inquiries, keep everything
        skipSection = false;
      }
    }

    // Skip lines in irrelevant sections
    if (skipSection) {
      continue;
    }

    pruned.push(line);
  }

  return pruned.join("\n");
}

/**
 * MiniAI preprocessing pipeline.
 * Runs intent classification and entity extraction before LLM call.
 * 
 * KEY OPTIMIZATION: For simple intents, returns a fast-path response
 * without calling the LLM — zero token cost.
 */
export async function preprocessMessage(input: PipelineInput): Promise<PipelineResult> {
  const warnings: string[] = [];
  let intent: string | undefined;
  let intentConfidence: number | undefined;
  let miniAiUsed = false;

  const registry = getMiniAIRegistry();

  // Only run MiniAI if classifier is available
  if (registry.has("classifier")) {
    try {
      const engine = getMiniAIEngine();
      const result = await engine.execute("classifier", {
        input: {
          text: input.message,
          categories: INTENT_CATEGORIES,
          context: `Agent: ${input.agentId}`,
        },
      });

      if (result.success) {
        intent = result.output.bestCategory as string;
        intentConfidence = result.confidence;
        miniAiUsed = true;
      }
    } catch {
      warnings.push("MiniAI classification failed, proceeding without preprocessing");
    }
  }

  // Extract entities (simple regex-based for V1, deterministic)
  const entities = extractEntities(input.message);

  // FAST-PATH CHECK: Can we answer without LLM?
  const fastPathResponse = generateFastPathResponse(
    intent || "general",
    input.message,
    input.agentId,
  );

  // STATUS QUERY CHECK: Is this a status query about tasks/agents?
  const statusQuery = detectStatusQuery(input.message);

  const canAnswerWithoutLLM = fastPathResponse !== null || statusQuery !== null;

  return {
    systemPrompt: "", // Built by buildEnrichedPrompt
    userMessage: input.message,
    intent,
    intentConfidence,
    entities,
    miniAiUsed,
    canAnswerWithoutLLM,
    fastPathResponse: fastPathResponse || undefined,
    isStatusQuery: statusQuery !== null,
    statusQueryAgent: statusQuery?.agentId ?? null,
    warnings,
  };
}

/**
 * Extract entities from user message using simple patterns.
 * V1: regex-based extraction. V2: use NER MiniAI.
 */
function extractEntities(message: string): Record<string, unknown> {
  const entities: Record<string, unknown> = {};

  // Product names (quoted or capitalized phrases)
  const productMatch = message.match(/"([^"]+)"/g) || message.match(/'([^']+)'/g);
  if (productMatch) {
    entities.products = productMatch.map((m) => m.replace(/['"]/g, ""));
  }

  // URLs
  const urlMatch = message.match(/https?:\/\/[^\s]+/g);
  if (urlMatch) {
    entities.urls = urlMatch;
  }

  // Email addresses
  const emailMatch = message.match(/\b[\w.-]+@[\w.-]+\.\w+\b/g);
  if (emailMatch) {
    entities.emails = emailMatch;
  }

  // Numbers (potential quantities, prices)
  const numberMatch = message.match(/\b\d+(?:\.\d+)?(?:\s*[%$€£])?\b/g);
  if (numberMatch) {
    entities.numbers = numberMatch;
  }

  // Dates (simple patterns)
  const dateMatch = message.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g);
  if (dateMatch) {
    entities.dates = dateMatch;
  }

  return entities;
}

/**
 * Build an OPTIMIZED system prompt using MiniAI preprocessing results.
 * 
 * KEY OPTIMIZATION: 
 * - Compresses conversation history (saves ~50% tokens)
 * - Prunes irrelevant sections based on intent (saves ~20-40% tokens)
 * - Injects only relevant entities
 */
export function buildEnrichedPrompt(
  basePrompt: string,
  pipelineResult: PipelineResult,
  conversationHistory?: Array<{ role: string; content: string }>,
): string {
  // If fast-path, use minimal prompt
  if (pipelineResult.canAnswerWithoutLLM) {
    return `You are a helpful assistant. Respond briefly and naturally.`;
  }

  // Compress conversation history if provided
  let compressedHistory = "";
  if (conversationHistory && conversationHistory.length > 0) {
    compressedHistory = compressHistory(conversationHistory);
  }

  // Prune prompt based on intent
  const intent = pipelineResult.intent || "general";
  let prompt = prunePromptByIntent(basePrompt, intent, pipelineResult.entities || {});

  // Replace full conversation history with compressed version
  if (compressedHistory) {
    // Find and replace the conversation history section
    const historyRegex = /## Conversation History\n[\s\S]*?(?=\n## |\n$|$)/;
    if (historyRegex.test(prompt)) {
      prompt = prompt.replace(historyRegex, `## Conversation History\n${compressedHistory}`);
    } else {
      // History was pruned — add compressed version
      prompt += `\n\n## Conversation History\n${compressedHistory}`;
    }
  }

  // Inject intent context if detected with high confidence
  if (pipelineResult.intent && pipelineResult.intentConfidence && pipelineResult.intentConfidence > 0.5) {
    prompt += `\n\n## Message Analysis`;
    prompt += `\nDetected intent: ${pipelineResult.intent} (confidence: ${(pipelineResult.intentConfidence * 100).toFixed(0)}%)`;

    // Add intent-specific instructions (compact)
    switch (pipelineResult.intent) {
      case "task_request":
        prompt += `\nBreak down into actionable steps.`;
        break;
      case "question":
        prompt += `\nProvide a clear, direct answer.`;
        break;
      case "complaint":
        prompt += `\nAcknowledge empathetically and offer solutions.`;
        break;
      case "product_inquiry":
        prompt += `\nProvide detailed product information.`;
        break;
      case "marketing_request":
        prompt += `\nFocus on strategy and creative suggestions.`;
        break;
      case "financial_query":
        prompt += `\nBe precise with numbers and data.`;
        break;
    }
  }

  // Inject ONLY relevant entities
  if (pipelineResult.entities) {
    const entityParts: string[] = [];
    if (pipelineResult.entities.products) {
      entityParts.push(`Products: ${JSON.stringify(pipelineResult.entities.products)}`);
    }
    if (pipelineResult.entities.urls) {
      entityParts.push(`URLs: ${JSON.stringify(pipelineResult.entities.urls)}`);
    }
    if (entityParts.length > 0) {
      prompt += `\n\n## Entities\n${entityParts.join("\n")}`;
    }
  }

  // Calculate token savings
  const originalTokens = estimateTokens(basePrompt);
  const optimizedTokens = estimateTokens(prompt);
  pipelineResult.tokenSavings = {
    originalPromptTokens: originalTokens,
    optimizedPromptTokens: optimizedTokens,
    saved: originalTokens - optimizedTokens,
  };

  return prompt;
}
