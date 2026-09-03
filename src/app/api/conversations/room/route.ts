// GET /api/conversations/room — Load room conversation for a workspace
// POST /api/conversations/room — Send a message in a Company Room

import { NextRequest, NextResponse } from "next/server";
import { getConversationEngine } from "@/lib/ai/conversation-engine";
import { multiAgentChat } from "@/lib/ai/multi-agent-chat";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";

interface RoomMessageRequest {
  message: string;
  /** @mention target — agent ID to route to. null = fan-out mode (CEO coordinates). */
  targetAgentId?: string;
}

// GET: Load room conversation + messages (no side effects)
export async function GET(req: NextRequest) {
  try {
    // Auth + workspace check
    const auth = await requireWorkspaceAccess(req);
    if ("error" in auth) return auth.error;

    const engine = getConversationEngine();

    // Find existing room conversation for this workspace
    const conversations = await engine.listByWorkspace(auth.workspaceId);
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
    // Auth + workspace check
    const auth = await requireWorkspaceAccess(req);
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const { message, targetAgentId } = body as RoomMessageRequest;

    if (!message) {
      return NextResponse.json(
        { success: false, error: "message is required" },
        { status: 400 }
      );
    }

    const engine = getConversationEngine();

    // 1. Get or create room conversation for this workspace
    const conversation = await engine.getOrCreateRoom(auth.workspaceId);
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Failed to create room conversation" },
        { status: 500 }
      );
    }

    // 2. Send message via multi-agent chat (fan-out or @mention)
    const result = await multiAgentChat({
      message,
      conversationId: conversation.id,
      workspaceId: auth.workspaceId,
      targetAgentId: targetAgentId || undefined,
    });

    // 3. Add all participating agents as participants in the room
    for (const response of result.agentResponses) {
      await engine.addParticipant(conversation.id, response.agentId, "participant");
    }

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      userMessage: {
        id: result.userMessage.id,
        content: result.userMessage.content,
        role: result.userMessage.role,
        createdAt: result.userMessage.created_at,
      },
      agentResponses: result.agentResponses.map((r) => ({
        agentId: r.agentId,
        id: r.message.id,
        content: r.message.content,
        role: r.message.role,
        provider: r.message.provider,
        model: r.message.model,
        createdAt: r.message.created_at,
      })),
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
