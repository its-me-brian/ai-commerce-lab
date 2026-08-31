// Agent Prompt Builder
// Converts AgentDefinition into structured system prompts for LLMs.
// This is the SINGLE responsible for prompt construction.
// Modify this to change prompt format without touching agents.

import type {
  AgentDefinition,
  PromptBuilderInput,
  PromptBuilderOutput,
} from "./types-agent-definition";

export class AgentPromptBuilder {
  /**
   * Build a complete system prompt from an AgentDefinition.
   */
  build(input: PromptBuilderInput): PromptBuilderOutput {
    const { definition } = input;

    const sections = {
      identity: this.buildIdentitySection(definition),
      mission: this.buildMissionSection(definition),
      personality: this.buildPersonalitySection(definition),
      expertise: this.buildExpertiseSection(definition),
      rules: this.buildRulesSection(definition),
      skills: this.buildSkillsSection(definition),
      outputInstructions: this.buildOutputSection(definition),
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
    const lines = [`# PERSONALITY`, ``];

    if (personality.traits.length > 0) {
      lines.push(
        `You are ${personality.traits.map((t) => this.humanizeTrait(t)).join(", ")}.`
      );
    }

    if (personality.communicationStyle.length > 0) {
      lines.push(
        ``
      );
      lines.push(
        `Communication: ${personality.communicationStyle.join(", ")}.`
      );
    }

    if (personality.decisionStyle) {
      lines.push(
        ``
      );
      lines.push(
        `Decision approach: ${this.humanizeDecisionStyle(personality.decisionStyle)}.`
      );
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
