// Agent Definition Types
// Core types for Agent Identity, Mission, Personality, Expertise, Rules, Skills.
// These types define WHAT an agent IS — separate from HOW it executes.

// ============================================
// PERSONALITY
// ============================================

export type PersonalityTrait =
  | "analytical"
  | "skeptical"
  | "data-driven"
  | "risk-aware"
  | "commercially-minded"
  | "creative"
  | "methodical"
  | "decisive"
  | "cautious"
  | "empathetic"
  | "assertive"
  | "detail-oriented"
  | "strategic"
  | "operational"
  | "results-driven";

export type CommunicationStyle =
  | "concise"
  | "detailed"
  | "structured"
  | "evidence-based"
  | "persuasive"
  | "formal"
  | "friendly"
  | "direct"
  | "diplomatic";

export type DecisionStyle =
  | "conservative"
  | "opportunity-focused"
  | "data-driven"
  | "intuitive"
  | "collaborative"
  | "fast-paced"
  | "cautious";

export interface Personality {
  traits: PersonalityTrait[];
  communicationStyle: CommunicationStyle[];
  decisionStyle: DecisionStyle;
}

// ============================================
// IDENTITY
// ============================================

export interface AgentIdentity {
  name: string;
  role: string;
  description: string;
  avatar?: string;
}

// ============================================
// SKILL
// ============================================

export interface SkillDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  instructions?: string;
  category?: string;
  enabled: boolean;
}

// ============================================
// OUTPUT INSTRUCTIONS
// ============================================

export interface OutputInstructions {
  format: "json" | "text" | "markdown" | "structured";
  constraints?: string[];
  examples?: string[];
}

// ============================================
// AGENT DEFINITION
// ============================================

export type AgentDefinitionStatus =
  | "ready"
  | "coming_soon"
  | "development"
  | "disabled";

export interface AgentDefinition {
  id: string;
  slug: string;
  version: string;
  status: AgentDefinitionStatus;
  enabled: boolean;

  // Identity & Mission
  identity: AgentIdentity;
  mission: string;

  // Personality
  personality: Personality;

  // Expertise
  expertise: string[];

  // Rules
  rules: string[];

  // Skills (slugs referencing SkillDefinition)
  skills: string[];

  // Output
  outputInstructions?: OutputInstructions;
}

// ============================================
// AGENT DEFINITION REGISTRY ENTRY
// ============================================

export interface AgentDefinitionRegistryEntry {
  definition: AgentDefinition;
  implementation?: string; // class name or module path — resolved at runtime
}

// ============================================
// PROMPT BUILDER INPUT
// ============================================

export interface PromptBuilderInput {
  definition: AgentDefinition;
  additionalContext?: Record<string, unknown>;
}

// ============================================
// PROMPT BUILDER OUTPUT
// ============================================

export interface PromptBuilderOutput {
  systemPrompt: string;
  sections: {
    identity: string;
    mission: string;
    personality: string;
    expertise: string;
    rules: string;
    skills: string;
    outputInstructions: string;
  };
}
