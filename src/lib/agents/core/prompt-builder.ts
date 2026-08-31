// Agent Prompt Builder
// Converts AgentDefinition into structured system prompts for LLMs.
// This is the SINGLE responsible for prompt construction.
// Modify this to change prompt format without touching agents.
//
// FASE 3: Now supports workspace personality overrides and enhanced personality fields.

import type {
  AgentDefinition,
  Personality,
  PromptBuilderInput,
  PromptBuilderOutput,
} from "./types-agent-definition";
import { mergePersonalities } from "./personality-presets";

export class AgentPromptBuilder {
  /**
   * Build a complete system prompt from an AgentDefinition.
   * Optionally applies workspace personality overrides.
   */
  build(input: PromptBuilderInput): PromptBuilderOutput {
    const { definition, additionalContext } = input;

    // FASE 3: Apply workspace personality overrides if provided
    const workspaceOverrides = additionalContext?.personalityOverrides as Partial<Personality> | undefined;
    const effectivePersonality = mergePersonalities(
      definition.personality,
      workspaceOverrides || null
    );

    // Create a virtual definition with merged personality
    const effectiveDefinition: AgentDefinition = {
      ...definition,
      personality: effectivePersonality,
    };

    const sections = {
      identity: this.buildIdentitySection(effectiveDefinition),
      mission: this.buildMissionSection(effectiveDefinition),
      personality: this.buildPersonalitySection(effectiveDefinition),
      expertise: this.buildExpertiseSection(effectiveDefinition),
      rules: this.buildRulesSection(effectiveDefinition),
      skills: this.buildSkillsSection(effectiveDefinition),
      outputInstructions: this.buildOutputSection(effectiveDefinition),
    };

    const systemPrompt = [
      sections.identity,
      sections.mission,
      sections.personality,
      sections.expertise,
      sections.rules,
      sections.skills,
      sections.outputInstructions,
    ]
      .filter((s) => s.length > 0)
      .join("\n\n");

    return { systemPrompt, sections };
  }

  private buildIdentitySection(def: AgentDefinition): string {
    const lines = [
      `# IDENTITY`,
      ``,
      `You are ${def.identity.name}, a ${def.identity.role}.`,
      ``,
      def.identity.description,
    ];
    return lines.join("\n");
  }

  private buildMissionSection(def: AgentDefinition): string {
    return [`# MISSION`, ``, def.mission].join("\n");
  }

  private buildPersonalitySection(def: AgentDefinition): string {
    const { personality } = def;

    // FASE 3: If customInstructions is set, use it as the complete personality section
    if (personality.customInstructions) {
      return [`# PERSONALITY`, ``, personality.customInstructions].join("\n");
    }

    const lines = [`# PERSONALITY`, ``];

    if (personality.traits.length > 0) {
      lines.push(
        `You are ${personality.traits.map((t) => this.humanizeTrait(t)).join(", ")}.`
      );
    }

    if (personality.communicationStyle.length > 0) {
      lines.push(``);
      lines.push(
        `Communication: ${personality.communicationStyle.join(", ")}.`
      );
    }

    if (personality.decisionStyle) {
      lines.push(``);
      lines.push(
        `Decision approach: ${this.humanizeDecisionStyle(personality.decisionStyle)}.`
      );
    }

    // FASE 3: New personality fields
    if (personality.tone) {
      lines.push(``);
      lines.push(`Tone: ${personality.tone}.`);
    }

    if (personality.values && personality.values.length > 0) {
      lines.push(``);
      lines.push(`Core values: ${personality.values.join(", ")}.`);
    }

    if (personality.constraints && personality.constraints.length > 0) {
      lines.push(``);
      lines.push(`Personality constraints:`);
      for (const constraint of personality.constraints) {
        lines.push(`- ${constraint}`);
      }
    }

    return lines.join("\n");
  }

  private buildExpertiseSection(def: AgentDefinition): string {
    if (def.expertise.length === 0) return "";

    const lines = [`# EXPERTISE`, ``];
    for (const item of def.expertise) {
      lines.push(`- ${this.capitalize(item)}`);
    }
    return lines.join("\n");
  }

  private buildRulesSection(def: AgentDefinition): string {
    if (def.rules.length === 0) return "";

    const lines = [`# RULES`, ``];
    for (const rule of def.rules) {
      lines.push(`- ${rule}`);
    }
    return lines.join("\n");
  }

  private buildSkillsSection(def: AgentDefinition): string {
    if (def.skills.length === 0) return "";

    const lines = [`# SKILLS`, ``];
    for (const skill of def.skills) {
      lines.push(`- ${this.slugToReadable(skill)}`);
    }
    return lines.join("\n");
  }

  private buildOutputSection(def: AgentDefinition): string {
    if (!def.outputInstructions) return "";

    const lines = [`# OUTPUT INSTRUCTIONS`, ``];
    lines.push(`Format your response as: ${def.outputInstructions.format}.`);

    if (def.outputInstructions.constraints?.length) {
      lines.push(``);
      for (const constraint of def.outputInstructions.constraints) {
        lines.push(`- ${constraint}`);
      }
    }

    return lines.join("\n");
  }

  // --- Helpers ---

  private humanizeTrait(trait: string): string {
    return trait
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
      .toLowerCase();
  }

  private humanizeDecisionStyle(style: string): string {
    const map: Record<string, string> = {
      conservative:
        "conservative when evidence is insufficient",
      "opportunity-focused":
        "opportunity-focused when evidence is strong",
      "data-driven": "data-driven, relying on evidence over intuition",
      intuitive: "intuitive when data is unavailable",
      collaborative: "collaborative, seeking input before decisions",
      "fast-paced": "fast-paced, acting quickly on strong signals",
      cautious: "cautious, verifying facts before committing to decisions",
    };
    return map[style] || style;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private slugToReadable(slug: string): string {
    return slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
}

// Singleton
let builderInstance: AgentPromptBuilder | null = null;

export function getPromptBuilder(): AgentPromptBuilder {
  if (!builderInstance) {
    builderInstance = new AgentPromptBuilder();
  }
  return builderInstance;
}
