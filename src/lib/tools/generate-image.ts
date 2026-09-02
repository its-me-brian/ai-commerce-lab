// Image Generation Stub Tool
// Provides image generation capability stub.
// Currently returns mock placeholders — swap with real API (DALL-E, Stable Diffusion) when ready.
// FASE: Swappable tool providers — mark clearly as mock.

import type { Tool, ToolResult } from "./types";

export interface GeneratedImage {
  url: string;
  prompt: string;
  width: number;
  height: number;
  source_type: "mock" | "real";
  model?: string;
}

export class GenerateImageTool implements Tool {
  readonly id = "generate_image";
  readonly name = "Generate Image";
  readonly description = "Generate product images. DEV STUB: returns placeholder images. Replace with DALL-E or Stable Diffusion for production.";
  readonly inputSchema = {
    type: "object",
    properties: {
      prompt: { type: "string", description: "Description of the image to generate" },
      style: { type: "string", description: "Style: product_photo, lifestyle, infographic", default: "product_photo" },
      width: { type: "number", description: "Image width in pixels", default: 512 },
      height: { type: "number", description: "Image height in pixels", default: 512 },
    },
    required: ["prompt"],
  };
  readonly outputSchema = {
    type: "object",
    properties: {
      images: { type: "array" },
      source_type: { type: "string" },
    },
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const prompt = (input.prompt as string) || "product image";
    const width = (input.width as number) || 512;
    const height = (input.height as number) || 512;

    // Mock: Generate placeholder images
    const images: GeneratedImage[] = [
      {
        url: `https://placehold.co/${width}x${height}?text=${encodeURIComponent(prompt.slice(0, 30))}`,
        prompt,
        width,
        height,
        source_type: "mock",
        model: "placeholder",
      },
      {
        url: `https://placehold.co/${width}x${height}/E8F5E9/1B5E20?text=${encodeURIComponent("Alt View")}`,
        prompt: `${prompt} - alternative angle`,
        width,
        height,
        source_type: "mock",
        model: "placeholder",
      },
    ];

    return {
      success: true,
      output: {
        images,
        source_type: "mock",
        note: "Replace with DALL-E/Stable Diffusion API for production",
      },
    };
  }
}
