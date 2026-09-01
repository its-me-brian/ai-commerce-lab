// GET /api/conversations/direct — Load existing direct conversation for an agent
// Returns the conversation + messages if it exists, null if not.

import { NextRequest, NextResponse } from "next/server";
import { getConversationEngine } from "@/lib/ai/conversation-engine";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "agentId is required" },
        { status: 400 }
      );
    }

    const engine = getConversationEngine();

    // Find existing active direct conversation for this agent
    const conversations = await engine.listByAgent(agentId);
    const direct = conversations.find(
      (c) => c.conversation_type === "direct" && c.status === "active"
    );

    if (!direct) {
      return NextResponse.json({
        success: true,
        conversation: null,
        messages: [],
      });
    }

    // Load messages
    const messages = await engine.getMessages(direct.id);

    return NextResponse.json({
      success: true,
      conversation: direct,
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
