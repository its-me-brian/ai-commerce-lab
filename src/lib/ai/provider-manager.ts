// Provider Manager
// Dynamic provider management from database.
// Replaces hardcoded AIProviderSlug union type with DB-driven providers.
// Handles provider CRUD, health checks, and capability queries.

import { supabase } from "../database/supabase";

export interface ProviderRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  api_key_env_var: string | null;
  base_url: string | null;
  capabilities: string[];
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
}

export interface ProviderCreateInput {
  id: string;
  name: string;
  slug: string;
  description?: string;
  api_key_env_var?: string;
  base_url?: string;
  capabilities?: string[];
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export interface ProviderUpdateInput {
  name?: string;
  description?: string;
  api_key_env_var?: string;
  base_url?: string;
  capabilities?: string[];
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export class ProviderManager {
  /**
   * Get all providers from DB.
   */
  async list(): Promise<ProviderRecord[]> {
    const { data, error } = await supabase
      .from("ai_providers")
      .select("*")
      .order("name");

    if (error || !data) return [];
    return data as ProviderRecord[];
  }

  /**
   * Get only enabled providers.
   */
  async listEnabled(): Promise<ProviderRecord[]> {
    const { data, error } = await supabase
      .from("ai_providers")
      .select("*")
      .eq("enabled", true)
      .order("name");

    if (error || !data) return [];
    return data as ProviderRecord[];
  }

  /**
   * Get provider by slug.
   */
  async getBySlug(slug: string): Promise<ProviderRecord | null> {
    const { data, error } = await supabase
      .from("ai_providers")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error || !data) return null;
    return data as ProviderRecord;
  }

  /**
   * Get provider by ID.
   */
  async getById(id: string): Promise<ProviderRecord | null> {
    const { data, error } = await supabase
      .from("ai_providers")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as ProviderRecord;
  }

  /**
   * Create a new provider.
   */
  async create(input: ProviderCreateInput): Promise<ProviderRecord | null> {
    const { data, error } = await supabase
      .from("ai_providers")
      .insert({
        id: input.id,
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        api_key_env_var: input.api_key_env_var || null,
        base_url: input.base_url || null,
        capabilities: input.capabilities || [],
        config: input.config || {},
        enabled: input.enabled !== false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) return null;
    return data as ProviderRecord;
  }

  /**
   * Update an existing provider.
   */
  async update(id: string, input: ProviderUpdateInput): Promise<ProviderRecord | null> {
    const { data, error } = await supabase
      .from("ai_providers")
      .update(input)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return null;
    return data as ProviderRecord;
  }

  /**
   * Enable or disable a provider.
   */
  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    const { error } = await supabase
      .from("ai_providers")
      .update({ enabled })
      .eq("id", id);

    return !error;
  }

  /**
   * Check if a provider has a required capability.
   */
  async hasCapability(slug: string, capability: string): Promise<boolean> {
    const provider = await this.getBySlug(slug);
    if (!provider) return false;
    return provider.capabilities.includes(capability);
  }

  /**
   * Get all providers that support a specific capability.
   */
  async listByCapability(capability: string): Promise<ProviderRecord[]> {
    const providers = await this.listEnabled();
    return providers.filter((p) => p.capabilities.includes(capability));
  }

  /**
   * Get the API key for a provider from environment variables.
   * Returns null if not set.
   */
  getApiKey(provider: ProviderRecord): string | null {
    if (!provider.api_key_env_var) return null;
    return process.env[provider.api_key_env_var] || null;
  }

  /**
   * Get the API key for a provider, checking env vars first, then CredentialManager.
   * This is the primary resolution method — use this instead of getApiKey().
   */
  async resolveApiKey(provider: ProviderRecord, workspaceId: string): Promise<{ key: string | null; source: "env" | "database" | "none" }> {
    // 1. Try environment variable first
    const envKey = this.getApiKey(provider);
    if (envKey) return { key: envKey, source: "env" };

    // 2. Try CredentialManager (DB-stored credential)
    try {
      const { getCredentialManager } = await import("./credential-manager");
      const credentialManager = getCredentialManager();
      const dbKey = await credentialManager.getActiveKey(provider.id, workspaceId);
      if (dbKey) return { key: dbKey, source: "database" };
    } catch {
      // CredentialManager unavailable — that's fine
    }

    return { key: null, source: "none" };
  }

  /**
   * Check if a provider has its API key configured (env or DB).
   */
  async isConfigured(slug: string, workspaceId: string): Promise<boolean> {
    const provider = await this.getBySlug(slug);
    if (!provider || !provider.enabled) return false;
    const { key } = await this.resolveApiKey(provider, workspaceId);
    return !!key;
  }

  /**
   * Get all providers with their configuration status.
   */
  async listWithStatus(workspaceId: string): Promise<
    Array<ProviderRecord & { configured: boolean; credentialSource: "env" | "database" | "none" }>
  > {
    const providers = await this.list();
    const results: Array<ProviderRecord & { configured: boolean; credentialSource: "env" | "database" | "none" }> = [];

    for (const p of providers) {
      const { key, source } = await this.resolveApiKey(p, workspaceId);
      results.push({
        ...p,
        configured: !!key,
        credentialSource: source,
      });
    }

    return results;
  }
}

// Singleton
let instance: ProviderManager | null = null;

export function getProviderManager(): ProviderManager {
  if (!instance) {
    instance = new ProviderManager();
  }
  return instance;
}
