// Message Router
// Intelligent routing for company room messages.
// Routes simple queries to MiniIA, complex research to CEO/Hunter.

import { logger } from "../logging";

export type MessageRoute = 
  | { type: "mini-ia"; reason: string }
  | { type: "ceo"; reason: string }
  | { type: "agent"; agentId: string; reason: string };

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
 */
export function routeMessage(message: string): MessageRoute {
  const trimmed = message.trim().toLowerCase();

  // Check for greetings (MiniIA)
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: "mini-ia", reason: "Greeting detected" };
    }
  }

  // Check for simple queries (MiniIA)
  for (const pattern of SIMPLE_QUERY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: "mini-ia", reason: "Simple query detected" };
    }
  }

  // Check for memory/catalog queries (MiniIA)
  for (const pattern of MEMORY_QUERY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: "mini-ia", reason: "Memory/catalog query detected" };
    }
  }

  // Check for product search queries (CEO/Hunter)
  for (const pattern of PRODUCT_SEARCH_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { type: "ceo", reason: "Product search query detected" };
    }
  }

  // Check for @mention
  const mentionMatch = message.match(/@(\S+)/);
  if (mentionMatch) {
    return { type: "agent", agentId: mentionMatch[1], reason: "@mention detected" };
  }

  // Default to CEO for complex queries
  return { type: "ceo", reason: "Complex query - CEO coordination" };
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
