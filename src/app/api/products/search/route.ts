import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";
import { withSecurity } from "@/lib/security/api-middleware";
import { chatWithAgent } from "@/lib/ai/agent-chat";

// POST /api/products/search
// Search for products using Product Hunter agent
// FASE 4: Uses service layer directly instead of internal HTTP call
export const POST = withSecurity(async (request: NextRequest) => {
  const auth = await requireWorkspaceAccess(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { query, mode = "discover" } = body as {
      query?: string;
      mode?: string;
    };

    if (!query) {
      return NextResponse.json(
        { success: false, error: "Query is required" },
        { status: 400 }
      );
    }

    // Call Product Hunter agent directly via service layer (no internal HTTP)
    const chatResult = await chatWithAgent({
      agentId: "product-hunter",
      message: JSON.stringify({ mode, query, name: query }),
      workspaceId: auth.workspaceId,
    });

    // Try to parse structured data from response
    let products = [];
    try {
      const content = chatResult.assistantMessage.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.products) {
          products = parsed.products;
        } else if (parsed.score !== undefined) {
          products = [parsed];
        }
      }
    } catch {
      // Response might be text-only, that's OK
    }

    return NextResponse.json({
      success: true,
      response: {
        id: chatResult.assistantMessage.id,
        content: chatResult.assistantMessage.content,
        role: chatResult.assistantMessage.role,
        provider: chatResult.assistantMessage.provider,
        model: chatResult.assistantMessage.model,
        tokens: {
          input: chatResult.assistantMessage.input_tokens,
          output: chatResult.assistantMessage.output_tokens,
        },
        durationMs: chatResult.assistantMessage.duration_ms,
        createdAt: chatResult.assistantMessage.created_at,
      },
      products,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
});
