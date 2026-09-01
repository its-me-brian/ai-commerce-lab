// Agent Definition Loader
// Loads agent definitions from DB with fallback to hardcoded definitions.
// FASE: Agent definitions from DB — allows updating agent identity/personality without code changes.

import { supabase } from "../database/supabase";
import { agentDefinitions } from "../agents/definitions";
import type { AgentDefinition } from "../agents/core/types-agent-definition";

export interface AgentDefinitionRecord {
  id: string;
  slug: string;
  version: string;
  status: string;
  enabled: boolean;
  identity_name: string;
  identity_role: string;
  identity_description: string;
  mission: string;
  personality: Record<string, unknown>;
  expertise: string[];
  rules: string[];
  skills: string[];
  output_instructions: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Convert a DB record to an AgentDefinition.
 */
function recordToDefinition(record: AgentDefinitionRecord): AgentDefinition {
  const personality = record.personality as {
    traits?: string[];
    communicationStyle?: string[];
    decisionStyle?: string;
    tone?: string;
    values?: string[];
    constraints?: string[];
    customInstructions?: string;
  };

  return {
    id: record.slug,
    slug: record.slug,
    version: record.version,
    status: record.status as AgentDefinition["status"],
    enabled: record.enabled,
    identity: {
      name: record.identity_name,
      role: record.identity_role,
      description: record.identity_description,
    },
    mission: record.mission,
    personality: {
      traits: personality.traits || [],
      communicationStyle: personality.communicationStyle || [],
      decisionStyle: personality.decisionStyle as AgentDefinition["personality"]["decisionStyle"],
      tone: personality.tone,
      values: personality.values,
      constraints: personality.constraints,
      customInstructions: personality.customInstructions,
    },
    expertise: record.expertise,
    rules: record.rules,
    skills: record.skills,
    outputInstructions: record.output_instructions as AgentDefinition["outputInstructions"],
  };
}

/**
 * Load all agent definitions from DB.
 * Falls back to hardcoded definitions if DB is unavailable.
 */
export async function loadDefinitionsFromDB(): Promise<Record<string, AgentDefinition>> {
  try {
    const { data, error } = await supabase
      .from("agent_definitions")
      .select("*")
      .order("slug");

    if (error || !data || data.length === 0) {
      console.warn("[DefinitionLoader] DB unavailable or empty, using hardcoded definitions");
      return agentDefinitions;
    }

    const definitions: Record<string, AgentDefinition> = {};
    for (const record of data as AgentDefinitionRecord[]) {
      definitions[record.slug] = recordToDefinition(record);
    }

    console.log(`[DefinitionLoader] Loaded ${Object.keys(definitions).length} definitions from DB`);
    return definitions;
  } catch (error) {
    console.warn("[DefinitionLoader] Failed to load from DB, using hardcoded:", error);
    return agentDefinitions;
  }
}

/**
 * Load a single agent definition from DB.
 * Falls back to hardcoded definition if not found in DB.
 */
export async function loadDefinitionFromDB(slug: string): Promise<AgentDefinition | undefined> {
  try {
    const { data, error } = await supabase
      .from("agent_definitions")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error || !data) {
      return agentDefinitions[slug];
    }

    return recordToDefinition(data as AgentDefinitionRecord);
  } catch {
    return agentDefinitions[slug];
  }
}
