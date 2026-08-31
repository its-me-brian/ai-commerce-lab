import { NextResponse } from "next/server";
import type { AIProviderSlug } from "@/lib/ai/types";

// POST /api/ai/test
// Tests connection to an AI provider
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, model } = body as {
      provider: AIProviderSlug;
      model: string;
    };

    if (!provider || !model) {
      return NextResponse.json(
        { success: false, error: "provider and model are required" },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Test based on provider
    switch (provider) {
      case "gemini": {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return NextResponse.json({
            success: false,
            provider,
            model,
            latencyMs: Date.now() - startTime,
            error: "GEMINI_API_KEY not configured",
          });
        }

        // Simple test call
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Say 'OK'" }] }],
              generationConfig: { maxOutputTokens: 10 },
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          return NextResponse.json({
            success: false,
            provider,
            model,
            latencyMs: Date.now() - startTime,
            error: errorData.error?.message || `HTTP ${response.status}`,
          });
        }

        return NextResponse.json({
          success: true,
          provider,
          model,
          latencyMs: Date.now() - startTime,
        });
      }

      case "anthropic": {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          return NextResponse.json({
            success: false,
            provider,
            model,
            latencyMs: Date.now() - startTime,
            error: "ANTHROPIC_API_KEY not configured",
          });
        }

        const response = await fetch(
          "https://api.anthropic.com/v1/messages",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model,
              max_tokens: 10,
              messages: [{ role: "user", content: "Say 'OK'" }],
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          return NextResponse.json({
            success: false,
            provider,
            model,
            latencyMs: Date.now() - startTime,
            error: errorData.error?.message || `HTTP ${response.status}`,
          });
        }

        return NextResponse.json({
          success: true,
          provider,
          model,
          latencyMs: Date.now() - startTime,
        });
      }

      case "xai": {
        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
          return NextResponse.json({
            success: false,
            provider,
            model,
            latencyMs: Date.now() - startTime,
            error: "XAI_API_KEY not configured",
          });
        }

        const response = await fetch(
          "https://api.x.ai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: "Say 'OK'" }],
              max_tokens: 10,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          return NextResponse.json({
            success: false,
            provider,
            model,
            latencyMs: Date.now() - startTime,
            error: errorData.error?.message || `HTTP ${response.status}`,
          });
        }

        return NextResponse.json({
          success: true,
          provider,
          model,
          latencyMs: Date.now() - startTime,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown provider: ${provider}` },
          { status: 400 }
        );
    }
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
