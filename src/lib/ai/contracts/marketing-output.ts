// Marketing Output Contracts
// Standardized output types for marketing deliverables.
// FASE 31: Structured types for ad copy, SEO, social posts, email sequences.

import { z } from "zod";

// --- Ad Copy Contract ---

export const AdCopySchema = z.object({
  headline: z.string().max(60),
  primaryText: z.string().max(500),
  description: z.string().max(300),
  callToAction: z.string(),
  platform: z.enum(["facebook", "instagram", "tiktok", "google", "email"]),
  format: z.enum(["image", "video", "carousel", "story", "reel"]),
});

export type AdCopy = z.infer<typeof AdCopySchema>;

// --- Social Post Contract ---

export const SocialPostSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "facebook", "twitter", "linkedin"]),
  content: z.string(),
  hashtags: z.array(z.string()),
  bestTime: z.string(),
  mediaType: z.enum(["image", "video", "carousel", "text"]).optional(),
  characterCount: z.number().optional(),
});

export type SocialPost = z.infer<typeof SocialPostSchema>;

// --- Email Contract ---

export const EmailSchema = z.object({
  subject: z.string(),
  previewText: z.string(),
  body: z.string(),
  purpose: z.enum(["welcome", "nurture", "conversion", "retention", "winback"]),
  estimatedOpenRate: z.number().optional(),
  estimatedClickRate: z.number().optional(),
});

export type Email = z.infer<typeof EmailSchema>;

// --- Hook Contract ---

export const HookSchema = z.object({
  text: z.string().max(100),
  platform: z.enum(["facebook", "tiktok", "instagram", "google", "email", "all"]),
  style: z.enum(["curiosity", "urgency", "social_proof", "pain_point", "transformation"]),
  estimatedCTR: z.number().optional(),
});

export type Hook = z.infer<typeof HookSchema>;

// --- Campaign Strategy Contract ---

export const CampaignStrategySchema = z.object({
  name: z.string(),
  objective: z.string(),
  budget: z.string(),
  duration: z.string(),
  targetAudience: z.string(),
  kpis: z.array(z.string()),
  channels: z.array(z.string()).optional(),
  estimatedROAS: z.number().optional(),
});

export type CampaignStrategy = z.infer<typeof CampaignStrategySchema>;

// --- SEO Content Contract ---

export const SEOContentSchema = z.object({
  titleTag: z.string().max(60),
  metaDescription: z.string().max(160),
  h1: z.string(),
  h2Tags: z.array(z.string()),
  keywords: z.array(z.string()),
  internalLinks: z.array(z.string()).optional(),
  imageAltTexts: z.array(z.string()).optional(),
});

export type SEOContent = z.infer<typeof SEOContentSchema>;

// --- Full Marketing Output ---

export const MarketingOutputSchema = z.object({
  adCopy: z.array(AdCopySchema),
  socialPosts: z.array(SocialPostSchema),
  emails: z.array(EmailSchema),
  hooks: z.array(HookSchema),
  campaignStrategy: CampaignStrategySchema,
  seo: SEOContentSchema.optional(),
  metadata: z.object({
    generatedAt: z.string().datetime(),
    productName: z.string(),
    targetAudience: z.string(),
    platform: z.string(),
    totalPieces: z.number(),
  }),
});

export type MarketingOutput = z.infer<typeof MarketingOutputSchema>;

// --- Helpers ---

/**
 * Count total marketing pieces in an output.
 */
export function countPieces(output: MarketingOutput): number {
  return (
    output.adCopy.length +
    output.socialPosts.length +
    output.emails.length +
    output.hooks.length
  );
}

/**
 * Get output summary for display.
 */
export function getMarketingSummary(output: MarketingOutput): string {
  const pieces = countPieces(output);
  const channels = new Set([
    ...output.adCopy.map((a) => a.platform),
    ...output.socialPosts.map((s) => s.platform),
    ...output.emails.map((e) => "email"),
  ]);

  return [
    `${pieces} marketing pieces generated`,
    `Campaign: ${output.campaignStrategy.name}`,
    `Channels: ${Array.from(channels).join(", ")}`,
    `Budget: ${output.campaignStrategy.budget}`,
    `KPIs: ${output.campaignStrategy.kpis.join(", ")}`,
  ].join("\n");
}

/**
 * Validate marketing output against schema.
 */
export function validateMarketingOutput(data: unknown): {
  valid: boolean;
  errors: string[];
  output: MarketingOutput | null;
} {
  const result = MarketingOutputSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [], output: result.data };
  }
  const zodErrors = result.error.issues || [];
  return {
    valid: false,
    errors: zodErrors.map((e) => `${e.path?.join(".") || "root"}: ${e.message}`),
    output: null,
  };
}
