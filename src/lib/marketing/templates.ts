// Marketing Campaign Templates
// Pre-built templates for common campaign types.
// Agents use these as starting points and customize per product.

export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  platform: string;
  objective: string;
  budget: string;
  duration: string;
  targetAudience: string;
  hooks: Array<{ text: string; style: string }>;
  adCopy: {
    headline: string;
    primaryText: string;
    description: string;
    callToAction: string;
  };
  emailSequence: Array<{
    subject: string;
    body: string;
    purpose: string;
  }>;
  kpis: string[];
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "product-launch",
    name: "Product Launch Blitz",
    description: "7-day intensive launch campaign across all platforms",
    platform: "all",
    objective: "Generate initial sales and reviews",
    budget: "€200-500",
    duration: "7 days",
    targetAudience: "Early adopters, 25-45, interested in the product category",
    hooks: [
      { text: "Just dropped — be the first to own this", style: "urgency" },
      { text: "Everyone is talking about this — see why", style: "social_proof" },
      { text: "Stop scrolling. You need this.", style: "curiosity" },
    ],
    adCopy: {
      headline: "🚀 New Arrival — Limited First Batch",
      primaryText: "We just discovered something incredible. Premium quality, unbeatable price, and shipping directly to your door. Early birds get 15% off with code LAUNCH15.",
      description: "Free shipping on orders over €30. 30-day money-back guarantee.",
      callToAction: "Shop Now — 15% Off",
    },
    emailSequence: [
      { subject: "It's here! 🎉 Your exclusive first look", body: "Hi {name}, we've been working on something special...", purpose: "welcome" },
      { subject: "Why everyone is obsessing over this", body: "Hi {name}, the reviews are in...", purpose: "nurture" },
      { subject: "Last chance: 15% off expires tonight", body: "Hi {name}, this is your final reminder...", purpose: "conversion" },
    ],
    kpis: ["CTR > 2%", "CPC < €0.50", "Conversion rate > 3%"],
  },
  {
    id: "social-proof",
    name: "Social Proof Campaign",
    description: "Leverage reviews and testimonials for trust building",
    platform: "facebook",
    objective: "Build trust and drive conversions",
    budget: "€100-300",
    duration: "14 days",
    targetAudience: "Skeptical buyers, 30-55, research-oriented",
    hooks: [
      { text: "See why 10,000+ customers love this", style: "social_proof" },
      { text: "Don't take our word for it — read the reviews", style: "social_proof" },
      { text: "The product that sold out 3 times", style: "urgency" },
    ],
    adCopy: {
      headline: "⭐ 4.8/5 Stars — 2,000+ Reviews",
      primaryText: "Don't just take our word for it. Thousands of happy customers can't be wrong. See what the hype is about.",
      description: "★★★★★ 'Best purchase I've made this year' — Maria T.",
      callToAction: "See Reviews & Buy",
    },
    emailSequence: [
      { subject: "What our customers are saying", body: "Hi {name}, here are some real reviews...", purpose: "nurture" },
      { subject: "Your friend recommended this to you", body: "Hi {name}, word of mouth is powerful...", purpose: "conversion" },
    ],
    kpis: ["Social engagement > 5%", "Review click-through > 8%", "Conversion rate > 4%"],
  },
  {
    id: "flash-sale",
    name: "Flash Sale Urgency",
    description: "48-hour flash sale with countdown and scarcity",
    platform: "all",
    objective: "Drive impulse purchases",
    budget: "€150-400",
    duration: "48 hours",
    targetAudience: "Impulse buyers, 18-35, FOMO-driven",
    hooks: [
      { text: "⏰ 48 hours only — up to 40% off", style: "urgency" },
      { text: "Almost gone — only 23 left in stock", style: "urgency" },
      { text: "Flash sale starts NOW", style: "urgency" },
    ],
    adCopy: {
      headline: "⚡ FLASH SALE — 48 Hours Only",
      primaryText: "This doesn't happen often. Up to 40% off for the next 48 hours only. When it's gone, it's gone.",
      description: "Free express shipping on all orders during the sale.",
      callToAction: "Grab Yours Before They're Gone",
    },
    emailSequence: [
      { subject: "⚡ Flash Sale starts NOW — up to 40% off", body: "Hi {name}, this is not a drill...", purpose: "conversion" },
      { subject: "⏰ 24 hours left — don't miss this", body: "Hi {name}, half the stock is already gone...", purpose: "conversion" },
      { subject: "FINAL HOURS — sale ends at midnight", body: "Hi {name}, this is your last chance...", purpose: "conversion" },
    ],
    kpis: ["CTR > 3%", "Conversion rate > 5%", "Revenue per click > €2"],
  },
  {
    id: "email-nurture",
    name: "Email Nurture Sequence",
    description: "5-email sequence to warm up cold leads",
    platform: "email",
    objective: "Build relationship and convert over time",
    budget: "€0 (organic)",
    duration: "10 days",
    targetAudience: "Newsletter subscribers, cart abandoners",
    hooks: [],
    adCopy: {
      headline: "",
      primaryText: "",
      description: "",
      callToAction: "",
    },
    emailSequence: [
      { subject: "Welcome! Here's what you're missing", body: "Hi {name}, thanks for joining...", purpose: "welcome" },
      { subject: "The story behind our bestseller", body: "Hi {name}, every product has a story...", purpose: "nurture" },
      { subject: "Exclusive tip: How to get the most value", body: "Hi {name}, here's a pro tip...", purpose: "nurture" },
      { subject: "Your friends are already loving this", body: "Hi {name}, social proof is real...", purpose: "nurture" },
      { subject: "A little something just for you 🎁", body: "Hi {name}, as a thank you...", purpose: "conversion" },
    ],
    kpis: ["Open rate > 25%", "Click rate > 5%", "Conversion rate > 2%"],
  },
];

/**
 * Get a template by ID.
 */
export function getTemplate(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.id === id);
}

/**
 * List all available templates.
 */
export function listTemplates(): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES;
}

/**
 * Get templates for a specific platform.
 */
export function getTemplatesByPlatform(platform: string): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES.filter(
    (t) => t.platform === platform || t.platform === "all"
  );
}
