import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";

// POST /api/ceo/orchestrate
// Send a goal to the CEO agent for orchestration
export async function POST(request: NextRequest) {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { goal } = body as { goal?: string };

    if (!goal) {
      return NextResponse.json(
        { success: false, error: "Goal is required" },
        { status: 400 }
      );
    }

    // Call the CEO agent via chat endpoint
    const chatRes = await fetch(`${request.url.replace("/ceo/orchestrate", "/agents/chat")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "ceo",
        message: `Goal: ${goal}\n\nPlease create an execution plan and coordinate the appropriate agents to achieve this goal.`,
      }),
    });

    const chatData = await chatRes.json();

    if (!chatData.success) {
      throw new Error(chatData.error || "Failed to communicate with CEO agent");
    }

    return NextResponse.json({
      success: true,
      conversationId: chatData.conversationId,
      response: chatData.assistantMessage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
