import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/auth/api-auth";

// POST /api/products/search
// Search for products using Product Hunter agent
export async function POST(request: NextRequest) {
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

    // Call Product Hunter agent via chat
    const chatRes = await fetch(`${request.url.replace("/products/search", "/agents/chat")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "product-hunter",
        message: JSON.stringify({ mode, query, name: query }),
      }),
    });

    const chatData = await chatRes.json();

    if (!chatData.success) {
      throw new Error(chatData.error || "Failed to communicate with Product Hunter");
    }

    // Try to parse structured data from response
    let products = [];
    try {
      const content = chatData.assistantMessage?.content || "";
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
      response: chatData.assistantMessage,
      products,
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
