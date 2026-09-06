// Intent Classifier
// Server-compatible intent classification using pattern matching.
// Fast, 0 tokens, works on both client and server.
// ONNX classification is optional (client-side only).

import type { IntentCategory } from "./intent-classifier-types";

// Re-export types
export type { IntentCategory } from "./intent-classifier-types";

export interface IntentResult {
  intent: IntentCategory;
  confidence: number;
  allIntents: Array<{ intent: IntentCategory; score: number }>;
  reasoning: string;
  inferenceTimeMs: number;
}

// Patterns for each intent
const INTENT_PATTERNS: Record<IntentCategory, RegExp[]> = {
  greeting: [
    /^(hola|hello|hi|buenos dias|buenas tardes|buenas noches|hey|que tal|como estas)/i,
    /^(adios|bye|chau|nos vemos|hasta luego)/i,
    /^(gracias|thanks|thank you)/i,
  ],
  product_search: [
    /(busca|buscar|encuentra|encontrar|search|find)\s+(productos?|articulos?|items?)/i,
    /(productos?\s+estrella|productos?\s+ganadores|winning\s+products?)/i,
    /(dropshipping|proveedor|supplier|aliexpress|alibaba|ebay)/i,
    /(precio|price|costo|cost|margen|margin|ganancia|profit)/i,
    /(envio|shipping|delivery)/i,
  ],
  memory_lookup: [
    /(producto|productos)\s+(anteriores?|previos?|pasados?|que\s+busque)/i,
    /(recuerdas|acordate|memory|memoria)/i,
    /(catalogo|catalog|inventario|inventory)/i,
    /(ya\s+busque|ya\s+buscamos|anteriormente)/i,
  ],
  simple_query: [
    /^(que puedes hacer|que sabes hacer|ayuda|help|commands|comandos)/i,
    /^(quien eres|que eres|como te llamas)/i,
    /^(cuantos agentes|que agentes|lista de agentes)/i,
  ],
  complex_query: [
    /(analiza|evalua|compara|investiga|estudia)/i,
    /(estrategia|plan|planifica|organiza)/i,
    /(reporte|resumen|dashboard|metricas)/i,
    /(configura|setup|instala|crea)/i,
  ],
  unknown: [],
};

/**
 * Classify user intent using pattern matching.
 * Fast, 0 tokens, works on server and client.
 */
export async function classifyIntent(text: string): Promise<IntentResult> {
  const startTime = Date.now();
  
  // Pattern-based classification
  const result = classifyWithPatterns(text);
  result.inferenceTimeMs = Date.now() - startTime;

  return result;
}

/**
 * Classify using pattern matching.
 */
function classifyWithPatterns(text: string): IntentResult {
  const intents: Array<{ intent: IntentCategory; score: number }> = [];

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (intent === "unknown") continue;
    
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        score = 1.0; // Exact match
        break;
      }
    }
    
    intents.push({ intent: intent as IntentCategory, score });
  }

  // Sort by score
  intents.sort((a, b) => b.score - a.score);

  const best = intents[0];

  return {
    intent: best.score > 0 ? best.intent : "unknown",
    confidence: best.score,
    allIntents: intents,
    reasoning: `Pattern matching: best match is "${best.intent}" with score ${best.score.toFixed(2)}`,
    inferenceTimeMs: 0,
  };
}

/**
 * Check if intent is simple (can be handled locally).
 */
export function isSimpleIntent(intent: IntentCategory): boolean {
  return ["greeting", "simple_query", "memory_lookup"].includes(intent);
}

/**
 * Check if intent needs LLM processing.
 */
export function needsLLM(intent: IntentCategory): boolean {
  return ["product_search", "complex_query", "unknown"].includes(intent);
}
