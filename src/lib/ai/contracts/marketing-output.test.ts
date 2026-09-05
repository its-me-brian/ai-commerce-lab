// Marketing Output Contract Tests
// FASE 31: Structured marketing output validation.

import { describe, it, expect } from "vitest";
import {
  MarketingOutputSchema,
  AdCopySchema,
  SocialPostSchema,
  EmailSchema,
  HookSchema,
  CampaignStrategySchema,
  SEOContentSchema,
  type MarketingOutput,
  type AdCopy,
  countPieces,
  getMarketingSummary,
  validateMarketingOutput,
} from "./marketing-output";

describe("Marketing Output Contract", () => {
  const validAdCopy: AdCopy = {
    headline: "Revolutionary Product",
    primaryText: "Experience the future of technology.",
    description: "A must-have for tech lovers.",
    callToAction: "Buy Now",
    platform: "facebook",
    format: "image",
  };

  const validOutput: MarketingOutput = {
    adCopy: [validAdCopy],
    socialPosts: [
      {
        platform: "instagram",
        content: "Exciting new product!",
        hashtags: ["#newproduct", "#tech"],
        bestTime: "6-8 PM",
      },
    ],
    emails: [
      {
        subject: "Welcome!",
        previewText: "Check out our new product",
        body: "Hi {{name}}, welcome!",
        purpose: "welcome",
      },
    ],
    hooks: [
      {
        text: "Discover the future",
        platform: "all",
        style: "curiosity",
      },
    ],
    campaignStrategy: {
      name: "Spring Launch",
      objective: "Drive sales",
      budget: "500",
      duration: "2 weeks",
      targetAudience: "Tech enthusiasts",
      kpis: ["ROAS > 3"],
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      productName: "Test Product",
      targetAudience: "Tech enthusiasts",
      platform: "all",
      totalPieces: 4,
    },
  };

  describe("AdCopySchema", () => {
    it("should accept valid ad copy", () => {
      const result = AdCopySchema.safeParse(validAdCopy);
      expect(result.success).toBe(true);
    });

    it("should reject missing headline", () => {
      const result = AdCopySchema.safeParse({ ...validAdCopy, headline: undefined });
      expect(result.success).toBe(false);
    });

    it("should reject invalid platform", () => {
      const result = AdCopySchema.safeParse({ ...validAdCopy, platform: "youtube" });
      expect(result.success).toBe(false);
    });
  });

  describe("SocialPostSchema", () => {
    it("should accept valid social post", () => {
      const result = SocialPostSchema.safeParse({
        platform: "tiktok",
        content: "Check this out!",
        hashtags: ["#viral"],
        bestTime: "7-9 PM",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid platform", () => {
      const result = SocialPostSchema.safeParse({
        platform: "youtube",
        content: "test",
        hashtags: [],
        bestTime: "12 PM",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("EmailSchema", () => {
    it("should accept valid email", () => {
      const result = EmailSchema.safeParse({
        subject: "Don't miss out!",
        previewText: "Limited time offer",
        body: "Buy now before it's too late!",
        purpose: "conversion",
      });
      expect(result.success).toBe(true);
    });

    it("should accept optional metrics", () => {
      const result = EmailSchema.safeParse({
        subject: "Welcome",
        previewText: "Hi there",
        body: "Welcome to our store",
        purpose: "welcome",
        estimatedOpenRate: 0.45,
        estimatedClickRate: 0.12,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("HookSchema", () => {
    it("should accept valid hook", () => {
      const result = HookSchema.safeParse({
        text: "You won't believe this!",
        platform: "facebook",
        style: "curiosity",
      });
      expect(result.success).toBe(true);
    });

    it("should reject text over 100 chars", () => {
      const result = HookSchema.safeParse({
        text: "x".repeat(101),
        platform: "all",
        style: "urgency",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("CampaignStrategySchema", () => {
    it("should accept valid strategy", () => {
      const result = CampaignStrategySchema.safeParse({
        name: "Summer Sale",
        objective: "Revenue",
        budget: "1000",
        duration: "1 month",
        targetAudience: "Women 25-35",
        kpis: ["ROAS > 4", "CTR > 3%"],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("SEOContentSchema", () => {
    it("should accept valid SEO content", () => {
      const result = SEOContentSchema.safeParse({
        titleTag: "Best Wireless Mouse 2026 | Store",
        metaDescription: "Discover our top-rated wireless mouse with ergonomic design.",
        h1: "Wireless Mouse Collection",
        h2Tags: ["Features", "Benefits", "Reviews"],
        keywords: ["wireless mouse", "ergonomic", "bluetooth"],
      });
      expect(result.success).toBe(true);
    });

    it("should reject title over 60 chars", () => {
      const result = SEOContentSchema.safeParse({
        titleTag: "x".repeat(61),
        metaDescription: "desc",
        h1: "H1",
        h2Tags: [],
        keywords: [],
      });
      expect(result.success).toBe(false);
    });

    it("should reject meta description over 160 chars", () => {
      const result = SEOContentSchema.safeParse({
        titleTag: "Title",
        metaDescription: "x".repeat(161),
        h1: "H1",
        h2Tags: [],
        keywords: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("MarketingOutputSchema", () => {
    it("should accept valid full output", () => {
      const result = MarketingOutputSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it("should reject missing adCopy", () => {
// eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { adCopy, ...rest } = validOutput;
      const result = MarketingOutputSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("should accept output without SEO", () => {
// eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { seo, ...rest } = validOutput;
      const result = MarketingOutputSchema.safeParse(rest);
      expect(result.success).toBe(true);
    });
  });

  describe("countPieces", () => {
    it("should count all pieces", () => {
      expect(countPieces(validOutput)).toBe(4);
    });

    it("should count correctly with multiple items", () => {
      const output: MarketingOutput = {
        ...validOutput,
        adCopy: [validAdCopy, validAdCopy, validAdCopy],
        socialPosts: [validOutput.socialPosts[0], validOutput.socialPosts[0]],
        emails: [],
        hooks: [],
      };
      expect(countPieces(output)).toBe(5);
    });
  });

  describe("getMarketingSummary", () => {
    it("should return readable summary", () => {
      const summary = getMarketingSummary(validOutput);
      expect(summary).toContain("4 marketing pieces");
      expect(summary).toContain("Spring Launch");
      expect(summary).toContain("facebook");
      expect(summary).toContain("500");
    });
  });

  describe("validateMarketingOutput", () => {
    it("should return valid for correct data", () => {
      const result = validateMarketingOutput(validOutput);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.output).toBeDefined();
    });

    it("should return errors for invalid data", () => {
      const result = validateMarketingOutput({ adCopy: "not an array" });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.output).toBeNull();
    });

    it("should return null output on failure", () => {
      const result = validateMarketingOutput({});
      expect(result.output).toBeNull();
    });
  });
});
