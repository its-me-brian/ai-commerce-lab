// GET /api/conversations/direct — Load existing direct conversation for an agent
// Returns the conversation + messages if it exists, null if not.

import { NextRequest, NextResponse } from "next/server";
import { getConversationEngine } from "@/lib/ai/conversation-engine";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";

export const GET = withSecurity(async (req: NextRequest) => {
  try {
    // Auth + workspace check
    const auth = await requireWorkspaceAccess(req);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: "agentId is required" },
        { status: 400 }
      );
    }

    const engine = getConversationEngine();

    // Find existing active direct conversation for this agent in this workspace
    const conversations = await engine.listByAgent(agentId, auth.workspaceId);
    const direct = conversations.find(
      (c) => c.conversation_type === "direct" && c.status === "active" && c.workspace_id === auth.workspaceId
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
  } catch  {
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});
