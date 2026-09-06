// MiniIA Handler
// Handles simple queries: greetings, memory lookups, basic questions.
// Fast and cheap - uses small models or rule-based responses.

import { logger } from "../logging";
import { getRouter } from "./router";
import { supabase } from "../database/supabase";
import type { ConversationMessage } from "./conversation-engine";

// Greeting responses (randomized for natural feel)
const GREETING_RESPONSES = [
  "Hola! Soy tu asistente de IA. ¿En qué puedo ayudarte hoy?",
  "¡Hola! Bienvenido. Estoy aquí para lo que necesites.",
  "Hey! ¿Qué tal? Pregúntame lo que quieras sobre productos, proveedores o tu negocio.",
  "¡Buenos días! ¿Cómo puedo asistirte?",
];

// Simple query responses
const SIMPLE_RESPONSES: Record<string, string> = {
  "que puedes hacer": "Puedo ayudarte con:\n- Buscar productos para dropshipping\n- Encontrar proveedores\n- Analizar márgenes de ganancia\n- Investigar tendencias del mercado\n- Responder preguntas sobre tu negocio\n\n¡Pregúntame lo que quieras!",
  "quien eres": "Soy tu asistente de IA especializado en ecommerce y dropshipping. Puedo buscar productos, analizar proveedores, calcular márgenes y mucho más.",
  "ayuda": "Escribe tu pregunta o solicitud. Si quieres buscar productos, dime 'busca productos de [categoría]'. Si quieres hablar con un agente específico, usa @nombre_del_agente.",
};

/**
 * Handle a simple message (greeting, basic query, memory lookup).
 */
export async function handleSimpleMessage(
  message: string,
  conversationId: string,
  workspaceId: string,
  historyLines: string[]
): Promise<ConversationMessage | null> {
  const trimmed = message.trim().toLowerCase();

  // 1. Check for greetings
  if (/^(hola|hello|hi|buenos dias|buenas tardes|buenas noches|hey|que tal)/i.test(trimmed)) {
    const response = GREETING_RESPONSES[Math.floor(Math.random() * GREETING_RESPONSES.length)];
    return saveResponse(response, conversationId, workspaceId, "mini-ia-greeting");
  }

  // 2. Check for simple static responses
  for (const [pattern, response] of Object.entries(SIMPLE_RESPONSES)) {
    if (trimmed.includes(pattern)) {
      return saveResponse(response, conversationId, workspaceId, "mini-ia-simple");
    }
  }

  // 3. Check for memory/catalog queries
  if (/(producto|productos)\s+(anteriores?|previos?|pasados?|que\s+busque|que\s+tengo)/i.test(trimmed) ||
      /(catalogo|catalog|inventario|inventory)/i.test(trimmed)) {
    return handleMemoryQuery(message, conversationId, workspaceId);
  }

  // 4. Check for "recuerdas" queries
  if (/(recuerdas|acordate|memory|memoria)/i.test(trimmed)) {
    return handleMemoryQuery(message, conversationId, workspaceId);
  }

  // 5. For other simple messages, use MiniIA model
  return handleWithMiniIA(message, conversationId, workspaceId, historyLines);
}

/**
 * Handle memory/catalog queries by searching Supabase.
 */
async function handleMemoryQuery(
  message: string,
  conversationId: string,
  workspaceId: string
): Promise<ConversationMessage | null> {
  try {
    // Search for previous product searches in conversation history
    const { data: conversations, error: convError } = await supabase
      .from("conversations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("conversation_type", "room")
      .limit(1);

    if (convError || !conversations || conversations.length === 0) {
      return saveResponse(
        "No tengo búsquedas anteriores en memoria. ¿Qué producto te gustaría buscar?",
        conversationId,
        workspaceId,
        "mini-ia-memory-empty"
      );
    }

    // Search for product-related messages in conversation history
    const roomId = conversations[0].id;
    const { data: messages, error: msgError } = await supabase
      .from("conversation_messages")
      .select("content, metadata, created_at")
      .eq("conversation_id", roomId)
      .eq("role", "user")
      .ilike("content", "%producto%")
      .order("created_at", { ascending: false })
      .limit(5);

    if (msgError || !messages || messages.length === 0) {
      return saveResponse(
        "No encontré búsquedas de productos anteriores. ¿Qué producto te gustaría buscar ahora?",
        conversationId,
        workspaceId,
        "mini-ia-memory-empty"
      );
    }

    // Format previous searches
    const previousSearches = messages
      .map((m, i) => `${i + 1}. ${m.content.substring(0, 100)}`)
      .join("\n");

    return saveResponse(
      `Encontré estas búsquedas anteriores:\n\n${previousSearches}\n\n¿Querés que busque información actualizada sobre alguno de estos productos?`,
      conversationId,
      workspaceId,
      "mini-ia-memory-found"
    );
  } catch (error) {
    logger.error("[MiniIA] Memory query error", { error: error instanceof Error ? error.message : String(error) });
    return saveResponse(
      "Hubo un error al buscar en memoria. ¿Podés repetir tu pregunta?",
      conversationId,
      workspaceId,
      "mini-ia-memory-error"
    );
  }
}

/**
 * Handle message with MiniIA model (fast, cheap).
 */
async function handleWithMiniIA(
  message: string,
  conversationId: string,
  workspaceId: string,
  historyLines: string[]
): Promise<ConversationMessage | null> {
  try {
    const router = getRouter();
    
    const systemPrompt = `Eres un asistente de IA para un negocio de ecommerce y dropshipping.
Responde de forma breve y útil. Si la pregunta es sobre productos, proveedores o negocios, 
sugiere al usuario que use "busca [producto]" para obtener resultados reales.

Si la pregunta es muy compleja o necesita datos en tiempo real, sugiere al usuario 
que pregunte directamente al CEO o al Product Hunter.`;

    const { result, log } = await router.generateForAgent(
      "mini-ia",
      {
        prompt: message,
        systemPrompt,
        responseFormat: "text",
      },
      { workspaceId }
    );

    return saveResponse(
      result.content,
      conversationId,
      workspaceId,
      "mini-ia-model",
      log.provider,
      log.model
    );
  } catch (error) {
    logger.error("[MiniIA] Model error", { error: error instanceof Error ? error.message : String(error) });
    return saveResponse(
      "No pude procesar tu pregunta. ¿Podés reformularla?",
      conversationId,
      workspaceId,
      "mini-ia-error"
    );
  }
}

/**
 * Save a response to the conversation.
 */
async function saveResponse(
  content: string,
  conversationId: string,
  workspaceId: string,
  agentId: string,
  provider?: string,
  model?: string
): Promise<ConversationMessage | null> {
  const { getConversationEngine } = await import("./conversation-engine");
  const engine = getConversationEngine();

  return engine.addMessage({
    conversation_id: conversationId,
    workspace_id: workspaceId,
    role: "assistant",
    content,
    provider,
    model,
    metadata: { agent_id: agentId },
  });
}
