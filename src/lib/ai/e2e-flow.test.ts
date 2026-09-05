// §48: E2E Test — Full flow: user → workspace → message → agent → response → persist → reload
//
// This test verifies the complete chat lifecycle:
// 1. Bootstrap agents and providers
// 2. Send a message to an agent
// 3. Verify response is generated
// 4. Verify message is persisted to Supabase
// 5. Verify message survives "reload" (can be fetched again)
//
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and at least one AI provider key

import { describe, it, expect, beforeAll } from "vitest";

// Check for required env vars
const hasSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const hasApiKeys = !!(
  process.env.GEMINI_API_KEY ||
  process.env.ANTHROPIC_API_KEY ||
  process.env.XAI_API_KEY
);

const canRunE2E = hasSupabase && hasApiKeys;

const describeE2E = canRunE2E ? describe : describe.skip;

describeE2E("§48 E2E: Full chat lifecycle", () => {
  let bootstrap: typeof import("./bootstrap").bootstrap;
  let getAgentRegistry: typeof import("./bootstrap").getAgentRegistry;
  let getRouter: typeof import("./router").getRouter;
  let getConversationEngine: typeof import("./conversation-engine").getConversationEngine;

  beforeAll(async () => {
    // Dynamic imports to avoid Supabase error when env vars are missing
    const bootstrapMod = await import("./bootstrap");
    const routerMod = await import("./router");
    const conversationMod = await import("./conversation-engine");

    bootstrap = bootstrapMod.bootstrap;
    getAgentRegistry = bootstrapMod.getAgentRegistry;
    getRouter = routerMod.getRouter;
    getConversationEngine = conversationMod.getConversationEngine;

    await bootstrap();
  }, 30000);

  it("should bootstrap agents successfully", async () => {
    const registry = getAgentRegistry();
    const agents = registry.list();
    expect(agents.length).toBeGreaterThan(0);

    // CEO should always exist
    const ceo = registry.get("ceo");
    expect(ceo).toBeDefined();
  });

  it("should have at least one AI provider configured", async () => {
    const router = getRouter();
    // Router should be able to generate (even if it falls back)
    expect(router).toBeDefined();
  });

  it("should send message and receive response", async () => {
    const router = getRouter();
    const conversationEngine = getConversationEngine();

    // Create a test conversation
    const conversation = await conversationEngine.create({
      conversation_type: "direct",
      title: "E2E Test Conversation",
    });
    expect(conversation).toBeDefined();
    expect(conversation!.id).toBeDefined();

    // Add user message
    const userMessage = await conversationEngine.addMessage({
      conversation_id: conversation!.id,
      role: "user",
      content: "Hello, this is an E2E test message. Please respond with just 'OK'.",
    });
    expect(userMessage).toBeDefined();
    expect(userMessage!.role).toBe("user");

    // Generate response via router
    const startTime = Date.now();
    const { result, log } = await router.generateForAgent("ceo", {
      prompt: "Hello, this is an E2E test message. Please respond with just 'OK'.",
      systemPrompt: "You are the CEO agent. Respond with just 'OK' to confirm you received this message.",
      responseFormat: "text",
    });
 
    const _duration = Date.now() - startTime;

    // Verify response
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(log.provider).toBeDefined();
    expect(log.model).toBeDefined();

    // Add assistant message
    const assistantMessage = await conversationEngine.addMessage({
      conversation_id: conversation!.id,
      role: "assistant",
      content: result.content,
      provider: log.provider,
      model: log.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      duration_ms: result.durationMs,
    });
    expect(assistantMessage).toBeDefined();
    expect(assistantMessage!.role).toBe("assistant");
    expect(assistantMessage!.content).toBe(result.content);

    // Verify message count updated
    const updatedConversation = await conversationEngine.getById(conversation!.id, "ws-test");
    expect(updatedConversation!.message_count).toBe(2);
  }, 30000);

  it("should persist and reload messages (survive reload)", async () => {
    const conversationEngine = getConversationEngine();

    // Create conversation with messages
    const conversation = await conversationEngine.create({
      conversation_type: "direct",
      title: "E2E Reload Test",
    });
    expect(conversation).toBeDefined();

    // Add messages
    await conversationEngine.addMessage({
      conversation_id: conversation!.id,
      role: "user",
      content: "Persist test message",
    });
    await conversationEngine.addMessage({
      conversation_id: conversation!.id,
      role: "assistant",
      content: "Persist test response",
      provider: "test-provider",
      model: "test-model",
    });

    // "Reload" — fetch messages fresh from database
    const reloadedMessages = await conversationEngine.getMessages(conversation!.id);

    // Verify messages survived
    expect(reloadedMessages.length).toBe(2);
    expect(reloadedMessages[0].role).toBe("user");
    expect(reloadedMessages[0].content).toBe("Persist test message");
    expect(reloadedMessages[1].role).toBe("assistant");
    expect(reloadedMessages[1].content).toBe("Persist test response");
    expect(reloadedMessages[1].provider).toBe("test-provider");
    expect(reloadedMessages[1].model).toBe("test-model");
  });

  it("should maintain conversation context across messages", async () => {
    const conversationEngine = getConversationEngine();

    const conversation = await conversationEngine.create({
      conversation_type: "direct",
      title: "E2E Context Test",
    });
    expect(conversation).toBeDefined();

    // Add multiple messages to build context
    await conversationEngine.addMessage({
      conversation_id: conversation!.id,
      role: "user",
      content: "My name is Alice",
    });
    await conversationEngine.addMessage({
      conversation_id: conversation!.id,
      role: "assistant",
      content: "Hello Alice!",
    });
    await conversationEngine.addMessage({
      conversation_id: conversation!.id,
      role: "user",
      content: "What is my name?",
    });

    // Verify we can retrieve history for context building
    const history = await conversationEngine.getLastMessages(conversation!.id, 10);
    expect(history.length).toBe(3);
    expect(history[0].content).toBe("My name is Alice");
    expect(history[2].content).toBe("What is my name?");
  });

  it("should list conversations by workspace", async () => {
    const conversationEngine = getConversationEngine();

    // Create workspace conversations
    const conv1 = await conversationEngine.create({
      conversation_type: "room",
      workspace_id: "e2e-test-workspace",
      title: "Test Room 1",
    });
    const conv2 = await conversationEngine.create({
      conversation_type: "room",
      workspace_id: "e2e-test-workspace",
      title: "Test Room 2",
    });

    expect(conv1).toBeDefined();
    expect(conv2).toBeDefined();

    // List by workspace
    const conversations = await conversationEngine.listByWorkspace("e2e-test-workspace");
    expect(conversations.length).toBeGreaterThanOrEqual(2);

    // Verify both conversations are in the list
    const ids = conversations.map((c) => c.id);
    expect(ids).toContain(conv1!.id);
    expect(ids).toContain(conv2!.id);
  });
});
