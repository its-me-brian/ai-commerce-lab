// Credential Manager
// Secure storage and retrieval of API keys.
// Keys are encrypted at rest using AES-256-GCM.
// Never exposes raw keys to the browser — only hints are returned.

import { logger } from "../logging";
import { supabase } from "../database/supabase";
import { encrypt, decrypt, getKeyHint } from "./encryption";

export interface CredentialRecord {
  id: string;
  provider_id: string;
  workspace_id: string;
  name: string;
  encrypted_key: string;
  key_hint: string | null;
  iv: string;
  auth_tag: string;
  environment: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CredentialCreateInput {
  provider_id: string;
  workspace_id: string;
  name: string;
  api_key: string;          // Raw key — will be encrypted before storage
  environment?: string;
  is_active?: boolean;
  expires_at?: string;
  created_by?: string;
}

export interface CredentialSafe {
  id: string;
  provider_id: string;
  name: string;
  key_hint: string | null;
  environment: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  // NO api_key, NO encrypted_key, NO iv, NO auth_tag
}

export class CredentialManager {
  /**
   * Store an API key securely (encrypted).
   * Returns a safe representation without the key.
   */
  async store(input: CredentialCreateInput): Promise<CredentialSafe | null> {
    // Encrypt the API key
    const encrypted = encrypt(input.api_key);
    const keyHint = getKeyHint(input.api_key);

    const { data, error } = await supabase
      .from("ai_provider_credentials")
      .insert({
        provider_id: input.provider_id,
        workspace_id: input.workspace_id,
        name: input.name,
        encrypted_key: encrypted.encrypted,
        key_hint: keyHint,
        iv: encrypted.iv,
        auth_tag: encrypted.authTag,
        environment: input.environment || "production",
        is_active: input.is_active !== false,
        expires_at: input.expires_at || null,
        created_by: input.created_by || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) return null;
    return this.toSafe(data as CredentialRecord);
  }

  /**
   * Retrieve and decrypt an API key.
   * Returns null if not found or expired.
   * USE WITH CAUTION — this exposes the raw key.
   * Requires workspaceId for tenant isolation.
   */
  async retrieve(credentialId: string, workspaceId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("ai_provider_credentials")
      .select("*")
      .eq("id", credentialId)
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .single();

    if (error || !data) return null;

    const credential = data as CredentialRecord;

    // Check expiration
    if (credential.expires_at && new Date(credential.expires_at) < new Date()) {
      logger.warn(`[CredentialManager] Credential ${credentialId} has expired`);
      return null;
    }

    // Decrypt
    try {
      return decrypt({
        encrypted: credential.encrypted_key,
        iv: credential.iv,
        authTag: credential.auth_tag,
      });
    } catch (err) {
      logger.error(
        `[CredentialManager] Failed to decrypt credential ${credentialId}:`,
        { error: err instanceof Error ? err.message : String(err) }
      );
      return null;
    }
  }

  /**
   * Get the active API key for a provider in a given environment.
   * This is the primary method for getting credentials.
   */
  async getActiveKey(
    providerId: string,
    workspaceId: string,
    environment: string = "production"
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from("ai_provider_credentials")
      .select("*")
      .eq("provider_id", providerId)
      .eq("workspace_id", workspaceId)
      .eq("environment", environment)
      .eq("is_active", true)
      .single();

    if (error || !data) return null;

    const credential = data as CredentialRecord;

    // Check expiration
    if (credential.expires_at && new Date(credential.expires_at) < new Date()) {
      return null;
    }

    try {
      return decrypt({
        encrypted: credential.encrypted_key,
        iv: credential.iv,
        authTag: credential.auth_tag,
      });
    } catch {
      return null;
    }
  }

  /**
   * List all credentials for a provider (safe — no keys).
   */
  async listByProvider(providerId: string, workspaceId: string): Promise<CredentialSafe[]> {
    const { data, error } = await supabase
      .from("ai_provider_credentials")
      .select("id, provider_id, name, key_hint, environment, is_active, workspace_id, created_at, updated_at, expires_at")
      .eq("provider_id", providerId)
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return (data as CredentialRecord[]).map(this.toSafe);
  }

  /**
   * List all credentials across all providers (safe — no keys).
   */
  async listAll(workspaceId: string): Promise<CredentialSafe[]> {
    const { data, error } = await supabase
      .from("ai_provider_credentials")
      .select("id, provider_id, name, key_hint, environment, is_active, workspace_id, created_at, updated_at, expires_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return (data as CredentialRecord[]).map(this.toSafe);
  }

  /**
   * Deactivate a credential.
   */
  async deactivate(credentialId: string, workspaceId: string): Promise<boolean> {
    const { error } = await supabase
      .from("ai_provider_credentials")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", credentialId)
      .eq("workspace_id", workspaceId);

    return !error;
  }

  /**
   * Delete a credential permanently.
   */
  async delete(credentialId: string, workspaceId: string): Promise<boolean> {
    const { error } = await supabase
      .from("ai_provider_credentials")
      .delete()
      .eq("id", credentialId)
      .eq("workspace_id", workspaceId);

    return !error;
  }

  /**
   * Check if a provider has any active credentials.
   */
  async hasActiveCredential(
    providerId: string,
    workspaceId: string,
    environment: string = "production"
  ): Promise<boolean> {
    const key = await this.getActiveKey(providerId, workspaceId, environment);
    return key !== null;
  }

  /**
   * Convert a full credential record to a safe representation.
   */
  private toSafe(record: CredentialRecord): CredentialSafe {
    return {
      id: record.id,
      provider_id: record.provider_id,
      name: record.name,
      key_hint: record.key_hint,
      environment: record.environment,
      is_active: record.is_active,
      expires_at: record.expires_at,
      created_at: record.created_at,
    };
  }
}

// Singleton
let instance: CredentialManager | null = null;

export function getCredentialManager(): CredentialManager {
  if (!instance) {
    instance = new CredentialManager();
  }
  return instance;
}
