// Response Generator
// Generates responses locally without LLM calls.
// Handles simple queries: greetings, FAQs, basic instructions.
// Saves 100% of tokens for simple interactions.

import type { IntentCategory } from "./intent-classifier";

export interface GeneratedResponse {
  content: string;
  source: "local" | "memory" | "template";
  confidence: number;
  tokensSaved: number;
}

// Response templates for each intent
const RESPONSE_TEMPLATES: Record<IntentCategory, string[]> = {
  greeting: [
    "¡Hola! Soy tu asistente de IA para ecommerce. ¿En qué puedo ayudarte hoy?",
    "¡Hola! Bienvenido. Estoy aquí para ayudarte con productos, proveedores y más.",
    "Hey! ¿Qué tal? Pregúntame lo que quieras sobre tu negocio.",
    "¡Buenos días! ¿Cómo puedo asistirte?",
  ],
  simple_query: [
    "Puedo ayudarte con:\n• Buscar productos para dropshipping\n• Encontrar proveedores\n• Analizar márgenes de ganancia\n• Investigar tendencias del mercado\n\n¿Qué necesitas?",
    "Soy tu asistente de IA especializado en ecommerce. Puedo buscar productos, analizar proveedores, calcular márgenes y más.",
    "Escribe tu pregunta o solicitud. Si quieres buscar productos, dime 'busca productos de [categoría]'.",
  ],
  memory_lookup: [
    "Déjame buscar en mis registros...",
    "Buscando en tu historial de búsquedas...",
    "Revisando tu catálogo de productos...",
  ],
  product_search: [
    "Entendido. Voy a buscar productos para ti. Un momento...",
    "Perfecto, voy a investigar opciones para ti.",
    "Déjame buscar las mejores opciones en el mercado.",
  ],
  complex_query: [
    "Entendido. Voy a analizar esto a fondo. Esto puede tomar unos minutos...",
    "Perfecto, voy a investigar esto en detalle.",
    "Déjame coordinar con los agentes especializados para esto.",
  ],
  unknown: [
    "No estoy seguro de entender. ¿Podrías reformular tu pregunta?",
    "Hmm, no tengo claro qué necesitas. ¿Puedes darme más detalles?",
    "¿Puedes explicarme mejor lo que buscas?",
  ],
};

// Quick responses for common acknowledgments
const QUICK_RESPONSES: Record<string, string> = {
  "ok": "¡Perfecto! Avísame si necesitas algo.",
  "dale": "¡Dale! Estoy aquí si me necesitás.",
  "gracias": "¡De nada! Estoy aquí para ayudarte.",
  "thanks": "¡De nada! Si necesitas algo más, avísame.",
  "si": "¡Genial! ¿Qué sigue?",
  "no": "Entendido. ¿Hay algo más en lo que pueda ayudarte?",
  "claro": "¡Perfecto! Estoy listo.",
  "bien": "¡Genial! ¿Qué necesitamos?",
  "genial": "¡Excelente! ¿Qué hacemos ahora?",
  "perfecto": "¡Perfecto! Estoy a tu disposición.",
};

// Greeting variations with time-aware responses
const TIME_BASED_GREETINGS: Record<string, string[]> = {
  morning: [
    "¡Buenos días! ¿En qué puedo ayudarte hoy?",
    "¡Buenos días! Espero que estés bien. ¿Qué necesitas?",
  ],
  afternoon: [
    "¡Buenas tardes! ¿Cómo puedo asistirte?",
    "¡Buenas tardes! Estoy aquí para lo que necesites.",
  ],
  evening: [
    "¡Buenas noches! ¿En qué puedo ayudarte?",
    "¡Buenas noches! ¿Qué necesitas?",
  ],
};

/**
 * Generate a local response without LLM.
 * Returns null if the query is too complex for local handling.
 */
export function generateLocalResponse(
  intent: IntentCategory,
  message: string,
  context?: {
    previousProducts?: string[];
    agentCount?: number;
    companyName?: string;
  }
): GeneratedResponse | null {
  const trimmed = message.trim().toLowerCase();

  // 1. Check for quick acknowledgments
  if (QUICK_RESPONSES[trimmed]) {
    return {
      content: QUICK_RESPONSES[trimmed],
      source: "local",
      confidence: 1.0,
      tokensSaved: estimateResponseTokens(QUICK_RESPONSES[trimmed]),
    };
  }

  // 2. Generate response based on intent
  switch (intent) {
    case "greeting":
      return generateGreetingResponse(trimmed);
    
    case "simple_query":
      return generateSimpleQueryResponse(trimmed, context);
    
    case "memory_lookup":
      return generateMemoryResponse(context);
    
    case "product_search":
      return generateProductSearchResponse();
    
    case "complex_query":
      return null; // Needs LLM
    
    default:
      return generateUnknownResponse();
  }
}

/**
 * Generate greeting response with time awareness.
 */
function generateGreetingResponse(message: string): GeneratedResponse {
  const hour = new Date().getHours();
  let timeOfDay: "morning" | "afternoon" | "evening";
  
  if (hour < 12) {
    timeOfDay = "morning";
  } else if (hour < 18) {
    timeOfDay = "afternoon";
  } else {
    timeOfDay = "evening";
  }

  const responses = TIME_BASED_GREETINGS[timeOfDay];
  const response = responses[Math.floor(Math.random() * responses.length)];

  // Add personalization if user mentioned name
  const nameMatch = message.match(/(?:soy|me llamo|mi nombre es)\s+(\w+)/i);
  if (nameMatch) {
    const name = nameMatch[1];
    return {
      content: `¡Hola ${name}! ${response}`,
      source: "local",
      confidence: 1.0,
      tokensSaved: estimateResponseTokens(response),
    };
  }

  return {
    content: response,
    source: "local",
    confidence: 1.0,
    tokensSaved: estimateResponseTokens(response),
  };
}

/**
 * Generate simple query response.
 */
function generateSimpleQueryResponse(
  message: string,
  context?: { agentCount?: number; companyName?: string }
): GeneratedResponse {
  const responses = RESPONSE_TEMPLATES.simple_query;
  let response = responses[Math.floor(Math.random() * responses.length)];

  // Customize based on context
  if (context?.agentCount) {
    response = response.replace(
      "Busca productos",
      `Con ${context?.agentCount || 8} agentes disponibles, puedo buscar productos`
    );
  }

  if (context?.companyName) {
    response = `Bienvenido a ${context?.companyName}. ${response}`;
  }

  // Check for specific questions
  if (message.includes("quien eres") || message.includes("que eres")) {
    response = "Soy tu asistente de IA especializado en ecommerce y dropshipping. Puedo buscar productos, analizar proveedores, calcular márgenes y mucho más.";
  } else if (message.includes("cuantos agentes") || message.includes("que agentes")) {
    const agentCount = context?.agentCount || 8;
    response = `Tenemos ${agentCount} agentes especializados: CEO, Product Hunter, Market Research, Supplier Research, Opportunity Scoring, Store Builder, Marketing y Finance.`;
  }

  return {
    content: response,
    source: "local",
    confidence: 0.9,
    tokensSaved: estimateResponseTokens(response),
  };
}

/**
 * Generate memory lookup response.
 */
function generateMemoryResponse(
  context?: { previousProducts?: string[] }
): GeneratedResponse {
  const template = RESPONSE_TEMPLATES.memory_lookup[0];
  
  if (context?.previousProducts && context.previousProducts.length > 0) {
    const productList = context.previousProducts
      .slice(0, 5)
      .map((p, i) => `${i + 1}. ${p}`)
      .join("\n");
    
    return {
      content: `Encontré estas búsquedas anteriores:\n\n${productList}\n\n¿Querés que busque información actualizada sobre alguno?`,
      source: "memory",
      confidence: 0.95,
      tokensSaved: estimateResponseTokens(productList),
    };
  }

  return {
    content: "No encontré búsquedas anteriores en memoria. ¿Qué producto te gustaría buscar?",
    source: "local",
    confidence: 0.8,
    tokensSaved: estimateResponseTokens(template),
  };
}

/**
 * Generate product search acknowledgment response.
 */
function generateProductSearchResponse(): GeneratedResponse {
  const responses = RESPONSE_TEMPLATES.product_search;
  const response = responses[Math.floor(Math.random() * responses.length)];

  return {
    content: response,
    source: "local",
    confidence: 0.7,
    tokensSaved: estimateResponseTokens(response),
  };
}

/**
 * Generate unknown intent response.
 */
function generateUnknownResponse(): GeneratedResponse {
  const responses = RESPONSE_TEMPLATES.unknown;
  const response = responses[Math.floor(Math.random() * responses.length)];

  return {
    content: response,
    source: "local",
    confidence: 0.5,
    tokensSaved: estimateResponseTokens(response),
  };
}

/**
 * Estimate tokens for a response.
 */
function estimateResponseTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Check if a message can be handled locally.
 */
export function canHandleLocally(intent: IntentCategory): boolean {
  return ["greeting", "simple_query", "memory_lookup"].includes(intent);
}

/**
 * Get response confidence threshold.
 */
export function getConfidenceThreshold(intent: IntentCategory): number {
  switch (intent) {
    case "greeting":
      return 0.95;
    case "simple_query":
      return 0.85;
    case "memory_lookup":
      return 0.80;
    case "product_search":
      return 0.70;
    case "complex_query":
      return 0.60;
    default:
      return 0.50;
  }
}
