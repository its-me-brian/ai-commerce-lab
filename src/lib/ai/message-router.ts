// Message Router
// Intelligent routing for company room messages.
// Routes simple queries to MiniIA, complex research to CEO/Hunter.
// Enhanced with ONNX intent classification and prompt optimization.

import { logger } from "../logging";
import { classifyIntent, isSimpleIntent, needsLLM, type IntentCategory } from "./mini-ai/intent-classifier";
import { generateLocalResponse, canHandleLocally } from "./mini-ai/response-generator";
import { optimizePrompt, optimizeUserMessage } from "./mini-ai/prompt-optimizer";
import type { OptimizationResult } from "./mini-ai/prompt-optimizer";

export type MessageRoute = 
  | { type: "mini-ia"; reason: string; intent: IntentCategory; localResponse?: string }
  | { type: "ceo"; reason: string; intent: IntentCategory; optimizedPrompt?: OptimizationResult }
  | { type: "agent"; agentId: string; reason: string; intent: IntentCategory };

// Patterns for simple queries (MiniIA handles these)
const GREETING_PATTERNS = [
  /^(hola|hello|hi|buenos dias|buenas tardes|buenas noches|hey|que tal|como estas)/i,
  /^(gracias|thanks|thank you|agradecido)/i,
  /^(adios|bye|chau|nos vemos|hasta luego)/i,
  /^(ok|dale|perfecto|genial|excelente|bien)/i,
];

const SIMPLE_QUERY_PATTERNS = [
  /^(que puedes hacer|que sabes hacer|ayuda|help|commands|comandos)/i,
  /^(quien eres|que eres|como te llamas)/i,
  /^(cuantos agentes|que agentes|lista de agentes)/i,
];

// Patterns for product-related queries (CEO/Hunter handles these)
const PRODUCT_SEARCH_PATTERNS = [
  /(busca|buscar|encuentra|encontrar|search|find)\s+(productos?|articulos?|items?|things?)/i,
  /(productos?\s+estrella|productos?\s+ganadores|winning\s+products?)/i,
  /(dropshipping|proveedor|supplier|aliexpress|alibaba|ebay)/i,
  /(precio|price|costo|cost|margen|margin|ganancia|profit)/i,
  /(envio|shipping|delivery|entrega)/i,
  /(competencia|competition|rival|competitor)/i,
  /(tendencia|trend|trending|popular|demand)/i,
];

const MEMORY_QUERY_PATTERNS = [
  /(producto|productos)\s+(anteriores?|previos?|pasados?|que\s+busque|que\s+tengo)/i,
  /(recuerdas|acordate|memory|memoria)\s+(de|del|que)/i,
  /(catalogo|catalog|inventario|inventory|lista)/i,
  /(ya\s+busque|ya\s+buscamos|anteriormente|before)/i,
];

/**
 * Route a message to the appropriate handler.
 * Uses ONNX intent classification + pattern matching.
 */
export async function routeMessage(message: string): Promise<MessageRoute> {
  const trimmed = message.trim().toLowerCase();

  // 1. Classify intent using ONNX + patterns
  let intent: IntentCategory;
  try {
    const result = await classifyIntent(message);
    intent = result.intent;
  } catch {
    // Fallback to pattern-based classification
    intent = classifyIntentFallback(trimmed);
  }

  // 2. Check for @mention (always route to specific agent)
  const mentionMatch = message.match(/@(\S+)/);
  if (mentionMatch) {
    return { 
      type: "agent", 
      agentId: mentionMatch[1], 
      reason: "@mention detected",
      intent 
    };
  }

  // 3. Route based on intent
  if (isSimpleIntent(intent) && canHandleLocally(intent)) {
    // Try to generate local response
    const localResponse = generateLocalResponse(intent, message);
    if (localResponse && localResponse.confidence > 0.8) {
      return { 
        type: "mini-ia", 
        reason: `Local response available (${localResponse.source})`,
        intent,
        localResponse: localResponse.content,
      };
    }
  }

  // 4. For product search or complex queries, optimize prompt for LLM
  if (needsLLM(intent)) {
    const optimizedPrompt = optimizeUserMessage(message);
    return { 
      type: "ceo", 
      reason: `Needs LLM processing (savings: ${optimizedPrompt.savingsPercent}%)`,
      intent,
      optimizedPrompt,
    };
  }

  // 5. Default to MiniIA for simple intents
  return { 
    type: "mini-ia", 
    reason: `Intent: ${intent}`,
    intent 
  };
}

/**
 * Fallback pattern-based intent classification.
 */
function classifyIntentFallback(text: string): IntentCategory {
  // Check for greetings
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(text)) {
      return "greeting";
    }
  }

  // Check for simple queries
  for (const pattern of SIMPLE_QUERY_PATTERNS) {
    if (pattern.test(text)) {
      return "simple_query";
    }
  }

  // Check for memory queries
  for (const pattern of MEMORY_QUERY_PATTERNS) {
    if (pattern.test(text)) {
      return "memory_lookup";
    }
  }

  // Check for product search
  for (const pattern of PRODUCT_SEARCH_PATTERNS) {
    if (pattern.test(text)) {
      return "product_search";
    }
  }

  // Default to unknown
  return "unknown";
}

/**
 * Synchronous version for backward compatibility.
 * Uses pattern matching only (no ONNX).
 */
export function routeMessageSync(message: string): MessageRoute {
  const trimmed = message.trim().toLowerCase();
  const intent = classifyIntentFallback(trimmed);

  // Check for @mention
  const mentionMatch = message.match(/@(\S+)/);
  if (mentionMatch) {
    return { 
      type: "agent", 
      agentId: mentionMatch[1], 
      reason: "@mention detected",
      intent 
    };
  }

  // Route based on intent
  if (isSimpleIntent(intent)) {
    return { 
      type: "mini-ia", 
      reason: `Intent: ${intent}`,
      intent 
    };
  }

  return { 
    type: "ceo", 
    reason: `Intent: ${intent}`,
    intent 
  };
}

/**
 * Check if a message is a simple greeting or acknowledgment.
 */
export function isSimpleMessage(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  return GREETING_PATTERNS.some(p => p.test(trimmed)) ||
         /^(ok|dale|si|no|claro|por favor|gracias)$/i.test(trimmed);
}

/**
 * Check if a message needs memory lookup.
 */
export function needsMemoryLookup(message: string): boolean {
  return MEMORY_QUERY_PATTERNS.some(p => p.test(message.toLowerCase()));
}

/**
 * Optimize prompts for a specific agent type.
 */
export function optimizeForAgent(
  prompt: string, 
  agentType: "simple" | "complex" | "research"
): OptimizationResult {
  const { optimizeSystemPrompt } = require("./mini-ai/prompt-optimizer");
  return optimizeSystemPrompt(prompt, agentType);
}
