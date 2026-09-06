// Intent Classifier with ONNX
// Client-side intent classification using small ONNX models.
// Classifies messages into: greeting, product_search, memory_lookup, simple_query, complex_query
// Runs entirely in browser - 0 tokens, ~50ms inference time.

"use client";

import { getBrowserMLProvider } from "./browser-ml/provider";

// Intent categories
export type IntentCategory = 
  | "greeting"
  | "product_search" 
  | "memory_lookup"
  | "simple_query"
  | "complex_query"
  | "unknown";

export interface IntentResult {
  intent: IntentCategory;
  confidence: number;
  allIntents: Array<{ intent: IntentCategory; score: number }>;
  reasoning: string;
  inferenceTimeMs: number;
}

// Patterns for each intent (used as fallback and for training data)
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
    /^(ok|dale|perfecto|genial|excelente|bien|si|no|claro)$/i,
  ],
  complex_query: [
    /(analiza|evalua|compara|investiga|estudia)/i,
    /(estrategia|plan|planifica|organiza)/i,
    /(reporte|resumen|dashboard|metricas)/i,
    /(configura|setup|instala|crea)/i,
  ],
  unknown: [],
};

// Model for ONNX classification
const INTENT_MODEL = "Xenova/distilbert-base-uncased-finetuned-sst-2-english";
const INTENT_TASK = "text-classification";

/**
 * Classify user intent using ONNX model + pattern matching.
 * Falls back to pattern matching if ONNX model is unavailable.
 */
export async function classifyIntent(text: string): Promise<IntentResult> {
  const startTime = Date.now();
  
  // 1. Try ONNX classification first
  let onnxResult: IntentResult | null = null;
  try {
    onnxResult = await classifyWithONNX(text);
  } catch {
    // ONNX unavailable, continue with pattern matching
  }

  // 2. Pattern-based classification (always runs as fallback/supplement)
  const patternResult = classifyWithPatterns(text);

  // 3. Combine results (ONNX + patterns)
  const finalResult = combineResults(onnxResult, patternResult, text);
  finalResult.inferenceTimeMs = Date.now() - startTime;

  return finalResult;
}

/**
 * Classify using ONNX model (client-side, 0 tokens).
 */
async function classifyWithONNX(text: string): Promise<IntentResult | null> {
  const provider = getBrowserMLProvider();
  
  if (!provider.isAvailable()) {
    return null;
  }

  try {
    // Load model if not loaded
    await provider.loadModel(INTENT_MODEL, INTENT_TASK);
    
    // Run inference
    const result = await provider.inference(text);
    
    if (!result?.output) {
      return null;
    }

    // Map ONNX sentiment output to our intents
    // The model outputs POSITIVE/NEGATIVE with scores
    // We map these to our intent categories
    const sentimentScore = extractSentiment(result.output);
    
    // Simple mapping: positive sentiment → greeting/simple_query
    // Negative sentiment → complex_query (might be complaint)
    // Neutral → product_search (most common intent)
    const intents: Array<{ intent: IntentCategory; score: number }> = [
      { intent: "greeting", score: sentimentScore.positive * 0.7 },
      { intent: "simple_query", score: sentimentScore.positive * 0.5 },
      { intent: "product_search", score: sentimentScore.neutral * 0.6 },
      { intent: "complex_query", score: sentimentScore.negative * 0.4 },
      { intent: "memory_lookup", score: 0.2 },
    ];

    // Sort by score
    intents.sort((a, b) => b.score - a.score);

    return {
      intent: intents[0].intent,
      confidence: intents[0].score,
      allIntents: intents,
      reasoning: `ONNX sentiment: positive=${sentimentScore.positive.toFixed(2)}, negative=${sentimentScore.negative.toFixed(2)}`,
      inferenceTimeMs: 0,
    };
  } catch {
    return null;
  }
}

/**
 * Extract sentiment scores from ONNX model output.
 */
function extractSentiment(modelOutput: unknown): { positive: number; negative: number; neutral: number } {
  let positiveScore = 0.5;
  let negativeScore = 0.5;

  if (Array.isArray(modelOutput)) {
    for (const item of modelOutput) {
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        if (typeof obj.label === "string" && typeof obj.score === "number") {
          if (obj.label.toUpperCase() === "POSITIVE") {
            positiveScore = obj.score;
          } else if (obj.label.toUpperCase() === "NEGATIVE") {
            negativeScore = obj.score;
          }
        }
      }
    }
  } else if (typeof modelOutput === "object" && modelOutput !== null) {
    const obj = modelOutput as Record<string, unknown>;
    if (typeof obj.label === "string" && typeof obj.score === "number") {
      if (obj.label.toUpperCase() === "POSITIVE") {
        positiveScore = obj.score;
        negativeScore = 1 - obj.score;
      } else {
        negativeScore = obj.score;
        positiveScore = 1 - obj.score;
      }
    }
  }

  const neutralScore = 1 - positiveScore - negativeScore;

  return { positive: positiveScore, negative: negativeScore, neutral: Math.max(0, neutralScore) };
}

/**
 * Classify using pattern matching (always available, 0 tokens).
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
 * Combine ONNX and pattern results.
 */
function combineResults(
  onnxResult: IntentResult | null,
  patternResult: IntentResult,
  text: string
): IntentResult {
  // If no ONNX result, use pattern result
  if (!onnxResult) {
    return patternResult;
  }

  // If pattern match is strong (score > 0.8), trust it more
  if (patternResult.confidence > 0.8) {
    return {
      intent: patternResult.intent,
      confidence: patternResult.confidence,
      allIntents: patternResult.allIntents,
      reasoning: `Pattern override (high confidence): ${patternResult.reasoning}`,
      inferenceTimeMs: 0,
    };
  }

  // Otherwise, combine scores
  const combinedIntents: Array<{ intent: IntentCategory; score: number }> = [];
  
  for (const patternIntent of patternResult.allIntents) {
    const onnxIntent = onnxResult.allIntents.find(i => i.intent === patternIntent.intent);
    const combinedScore = (patternIntent.score * 0.6) + ((onnxIntent?.score || 0) * 0.4);
    combinedIntents.push({ intent: patternIntent.intent, score: combinedScore });
  }

  combinedIntents.sort((a, b) => b.score - a.score);

  const best = combinedIntents[0];

  return {
    intent: best.intent,
    confidence: best.score,
    allIntents: combinedIntents,
    reasoning: `Combined: pattern=${patternResult.confidence.toFixed(2)} + ONNX=${onnxResult.confidence.toFixed(2)}`,
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
