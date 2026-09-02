import { NextRequest, NextResponse } from "next/server";
import { chatWithAgent } from "@/lib/ai/agent-chat";
import { requireAuth } from "@/lib/auth/api-auth";

// POST /api/agents/chat
// Send a message to an agent and get a response.
// Body: { agentId, message, conversationId?, workspaceId? }
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await requireAuth(request);
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { agentId, message, conversationId, workspaceId } = body as {
      agentId?: string;
      message?: string;
      conversationId?: string;
      workspaceId?: string;
    };

    if (!agentId || !message) {
      return NextResponse.json(
        { success: false, error: "agentId and message are required" },
        { status: 400 }
      );
    }

    const result = await chatWithAgent({
      agentId,
      message,
      conversationId,
      workspaceId,
    });

    return NextResponse.json({
      success: true,
      conversationId: result.conversation.id,
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
        tokens: {
          input: result.assistantMessage.input_tokens,
          output: result.assistantMessage.output_tokens,
        },
        durationMs: result.assistantMessage.duration_ms,
        createdAt: result.assistantMessage.created_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
