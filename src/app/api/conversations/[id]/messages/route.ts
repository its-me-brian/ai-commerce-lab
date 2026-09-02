// GET /api/conversations/[id]/messages — Load messages for a conversation
// Used by ChatContainer to restore history from Supabase.

import { NextRequest, NextResponse } from "next/server";
import { getConversationEngine } from "@/lib/ai/conversation-engine";
import { requireAuth } from "@/lib/auth/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const engine = getConversationEngine();

    // Verify conversation exists
    const conversation = await engine.getById(id);
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Get all messages ordered chronologically
    const messages = await engine.getMessages(id);

    return NextResponse.json({
      success: true,
      conversation,
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
