// Model Registry
// CRUD + capability-aware queries for ai_models.
// FASE 7: Each model now has a capabilities array (vision, tool-use, etc.)

import { supabase } from "../database/supabase";

export interface ModelRecord {
  id: string;
  provider_id: string;
  name: string;
  model_id: string;
  enabled: boolean;
  context_window: number;
  input_price: number;
  output_price: number;
  capabilities: string[];
  created_at: string;
  updated_at: string;
}

export interface ModelCreateInput {
  id: string;
  provider_id: string;
  name: string;
  model_id: string;
  enabled?: boolean;
  context_window?: number;
  input_price?: number;
  output_price?: number;
  capabilities?: string[];
}

export interface ModelUpdateInput {
  name?: string;
  enabled?: boolean;
  context_window?: number;
  input_price?: number;
  output_price?: number;
  capabilities?: string[];
}

export class ModelRegistry {
  /**
   * Get all models.
   */
  async list(): Promise<ModelRecord[]> {
    const { data, error } = await supabase
      .from("ai_models")
      .select("*")
      .order("name");

    if (error || !data) return [];
    return data as ModelRecord[];
  }

  /**
   * Get only enabled models.
   */
  async listEnabled(): Promise<ModelRecord[]> {
    const { data, error } = await supabase
      .from("ai_models")
      .select("*")
      .eq("enabled", true)
      .order("name");

    if (error || !data) return [];
    return data as ModelRecord[];
  }

  /**
   * Get model by ID.
   */
  async getById(id: string): Promise<ModelRecord | null> {
    const { data, error } = await supabase
      .from("ai_models")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as ModelRecord;
  }

  /**
   * Get all models for a specific provider.
   */
  async listByProvider(providerId: string): Promise<ModelRecord[]> {
    const { data, error } = await supabase
      .from("ai_models")
      .select("*")
      .eq("provider_id", providerId)
      .order("name");

    if (error || !data) return [];
    return data as ModelRecord[];
  }

  /**
   * Get all models that have ALL of the specified capabilities.
   */
  async listByCapabilities(capabilities: string[]): Promise<ModelRecord[]> {
    const { data, error } = await supabase
      .from("ai_models")
      .select("*")
      .eq("enabled", true);

    if (error || !data) return [];

    return (data as ModelRecord[]).filter((model) =>
      capabilities.every((cap) => model.capabilities.includes(cap))
    );
  }

  /**
   * Get all models that have ANY of the specified capabilities.
   */
  async listByAnyCapability(capabilities: string[]): Promise<ModelRecord[]> {
    const { data, error } = await supabase
      .from("ai_models")
      .select("*")
      .eq("enabled", true);

    if (error || !data) return [];

    return (data as ModelRecord[]).filter((model) =>
      capabilities.some((cap) => model.capabilities.includes(cap))
    );
  }

  /**
   * Check if a model has a specific capability.
   */
  async hasCapability(modelId: string, capability: string): Promise<boolean> {
    const model = await this.getById(modelId);
    if (!model) return false;
    return model.capabilities.includes(capability);
  }

  /**
   * Create a new model.
   */
  async create(input: ModelCreateInput): Promise<ModelRecord | null> {
    const { data, error } = await supabase
      .from("ai_models")
      .insert({
        id: input.id,
        provider_id: input.provider_id,
        name: input.name,
        model_id: input.model_id,
        enabled: input.enabled !== false,
        context_window: input.context_window ?? 200000,
        input_price: input.input_price ?? 0,
        output_price: input.output_price ?? 0,
        capabilities: input.capabilities ?? [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) return null;
    return data as ModelRecord;
  }

  /**
   * Update an existing model.
   */
  async update(id: string, input: ModelUpdateInput): Promise<ModelRecord | null> {
    const { data, error } = await supabase
      .from("ai_models")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return null;
    return data as ModelRecord;
  }

  /**
   * Enable or disable a model.
   */
  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    const { error } = await supabase
      .from("ai_models")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("id", id);

    return !error;
  }

  /**
   * Delete a model.
   */
  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("ai_models")
      .delete()
      .eq("id", id);

    return !error;
  }
}

// Singleton
let instance: ModelRegistry | null = null;

export function getModelRegistry(): ModelRegistry {
  if (!instance) {
    instance = new ModelRegistry();
  }
  return instance;
}
