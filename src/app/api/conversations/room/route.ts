// GET /api/conversations/room — Load room conversation for a workspace
// POST /api/conversations/room — Send a message in a Company Room

import { NextRequest, NextResponse } from "next/server";
import { getConversationEngine } from "@/lib/ai/conversation-engine";
import { chatWithAgent } from "@/lib/ai/agent-chat";

interface RoomMessageRequest {
  workspaceId: string;
  message: string;
  /** @mention target — agent ID to route to. Defaults to "ceo". */
  targetAgentId?: string;
}

// GET: Load room conversation + messages (no side effects)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const engine = getConversationEngine();

    // Find existing room conversation
    const conversations = await engine.listByWorkspace(workspaceId);
    const room = conversations.find(
      (c) => c.conversation_type === "room" && c.status === "active"
    );

    if (!room) {
      // No room yet — return empty state (will be created on first message)
      return NextResponse.json({
        success: true,
        conversation: null,
        messages: [],
      });
    }

    // Load messages
    const messages = await engine.getMessages(room.id);

    return NextResponse.json({
      success: true,
      conversation: room,
      messages,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspaceId, message, targetAgentId } = body as RoomMessageRequest;

    if (!workspaceId || !message) {
      return NextResponse.json(
        { success: false, error: "workspaceId and message are required" },
        { status: 400 }
      );
    }

    const engine = getConversationEngine();

    // 1. Get or create room conversation for this workspace
    const conversation = await engine.getOrCreateRoom(workspaceId);
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Failed to create room conversation" },
        { status: 500 }
      );
    }

    // 2. Determine target agent (CEO by default)
    const agentId = targetAgentId || "ceo";

    // 3. Send message via agent-chat (handles history, context, LLM call)
    const result = await chatWithAgent({
      agentId,
      message,
      conversationId: conversation.id,
      workspaceId,
    });

    // 4. Add agent as participant in the room
    await engine.addParticipant(conversation.id, agentId, "participant");

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      targetAgentId: agentId,
      userMessage: {
        id: result.userMessage.id,
        content: result.userMessage.content,
        role: result.userMessage.role,
        createdAt: result.userMessage.created_at,
      },
      assistantMessage: {
        id: result.assistantMessage.id,
        content: result.assistantMessage.content,
        role: result.assistantMessage.role,
        provider: result.assistantMessage.provider,
        model: result.assistantMessage.model,
        createdAt: result.assistantMessage.created_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
