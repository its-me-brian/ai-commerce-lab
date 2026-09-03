// GET /api/conversations/[id]/messages — Load messages for a conversation
// Used by ChatContainer to restore history from Supabase.
// Supports pagination: ?limit=50&offset=0 (default: last 100 messages)

import { NextRequest, NextResponse } from "next/server";
import { getConversationEngine } from "@/lib/ai/conversation-engine";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const engine = getConversationEngine();

    // Verify conversation exists and belongs to this workspace
    const conversation = await engine.getById(id);
    if (!conversation) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    if (conversation.workspace_id !== auth.workspaceId) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100", 10), 1), 500);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    // Get messages with pagination
    const messages = await engine.getMessages(id, { limit, offset });
    const totalCount = await engine.getMessageCount(id);

    return NextResponse.json({
      success: true,
      conversation,
      messages,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
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
