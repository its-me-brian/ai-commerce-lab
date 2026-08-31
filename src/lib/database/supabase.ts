// Supabase Client
// Server-side Supabase client for database operations.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing Supabase environment variables. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
  );
}

// Server-side client with service role key (full access)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================
// Database Types
// Reflects the actual schema after all migrations (001-011).
// Generated manually — replace with `supabase gen types` when ready.
// ============================================

export interface Database {
  public: {
    Tables: {
      ai_providers: {
        Row: {
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
        };
        Insert: {
          id: string;
          name: string;
          slug: string;
          description?: string | null;
          api_key_env_var?: string | null;
          base_url?: string | null;
          capabilities?: string[];
          config?: Record<string, unknown>;
          enabled?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string | null;
          api_key_env_var?: string | null;
          base_url?: string | null;
          capabilities?: string[];
          config?: Record<string, unknown>;
          enabled?: boolean;
        };
      };
      ai_models: {
        Row: {
          id: string;
          provider_id: string;
          name: string;
          model_id: string;
          enabled: boolean;
          context_window: number;
          input_price: number;
          output_price: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          provider_id: string;
          name: string;
          model_id: string;
          enabled?: boolean;
          context_window?: number;
          input_price?: number;
          output_price?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          model_id?: string;
          enabled?: boolean;
          context_window?: number;
          input_price?: number;
          output_price?: number;
          updated_at?: string;
        };
      };
      agents: {
        Row: {
          id: string;
          name: string;
          description: string;
          enabled: boolean;
          status: string;
          version: string;
          role: string;
          identity: Record<string, unknown> | null;
          mission: string | null;
          personality: Record<string, unknown> | null;
          expertise: string[] | null;
          agent_rules: string[] | null;
          output_instructions: Record<string, unknown> | null;
          // Hierarchy (FASE 2)
          parent_agent_id: string | null;
          agent_type: string;
          department: string | null;
          workspace_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string;
          enabled?: boolean;
          status?: string;
          version?: string;
          role?: string;
          identity?: Record<string, unknown> | null;
          mission?: string | null;
          personality?: Record<string, unknown> | null;
          expertise?: string[] | null;
          agent_rules?: string[] | null;
          output_instructions?: Record<string, unknown> | null;
          // Hierarchy (FASE 2)
          parent_agent_id?: string | null;
          agent_type?: string;
          department?: string | null;
          workspace_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string;
          enabled?: boolean;
          status?: string;
          version?: string;
          role?: string;
          identity?: Record<string, unknown> | null;
          mission?: string | null;
          personality?: Record<string, unknown> | null;
          expertise?: string[] | null;
          agent_rules?: string[] | null;
          output_instructions?: Record<string, unknown> | null;
          // Hierarchy (FASE 2)
          parent_agent_id?: string | null;
          agent_type?: string;
          department?: string | null;
          workspace_id?: string | null;
          updated_at?: string;
        };
      };
      agent_configs: {
        Row: {
          id: string;
          agent_id: string;
          primary_provider_id: string;
          primary_model_id: string;
          fallback_provider_id: string | null;
          fallback_model_id: string | null;
          temperature: number;
          max_output_tokens: number;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          primary_provider_id: string;
          primary_model_id: string;
          fallback_provider_id?: string | null;
          fallback_model_id?: string | null;
          temperature?: number;
          max_output_tokens?: number;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          primary_provider_id?: string;
          primary_model_id?: string;
          fallback_provider_id?: string | null;
          fallback_model_id?: string | null;
          temperature?: number;
          max_output_tokens?: number;
          enabled?: boolean;
          updated_at?: string;
        };
      };
      agent_tasks: {
        Row: {
          id: string;
          agent_id: string;
          status: string;
          task_type: string;
          input: Record<string, unknown>;
          output: Record<string, unknown> | null;
          priority: number;
          error: string | null;
          total_cost: number;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          status?: string;
          task_type?: string;
          input: Record<string, unknown>;
          output?: Record<string, unknown> | null;
          priority?: number;
          error?: string | null;
          total_cost?: number;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          status?: string;
          output?: Record<string, unknown> | null;
          error?: string | null;
          total_cost?: number;
          completed_at?: string | null;
        };
      };
      agent_runs: {
        Row: {
          id: string;
          task_id: string;
          agent_id: string;
          provider: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          total_tokens: number;
          duration_ms: number;
          cost: number;
          status: string;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          agent_id: string;
          provider: string;
          model: string;
          input_tokens?: number;
          output_tokens?: number;
          total_tokens?: number;
          duration_ms?: number;
          cost?: number;
          status?: string;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          status?: string;
          error?: string | null;
          cost?: number;
        };
      };
      agent_permissions: {
        Row: {
          id: string;
          agent_id: string;
          action: string;
          target: string;
          granted: boolean;
          conditions: unknown[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          action: string;
          target: string;
          granted?: boolean;
          conditions?: unknown[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          action?: string;
          target?: string;
          granted?: boolean;
          conditions?: unknown[];
          updated_at?: string;
        };
      };
      skills: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string;
          instructions: string | null;
          category: string | null;
          enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string;
          instructions?: string | null;
          category?: string | null;
          enabled?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          description?: string;
          instructions?: string | null;
          category?: string | null;
          enabled?: boolean;
        };
      };
      agent_skills: {
        Row: {
          agent_id: string;
          skill_id: string;
          created_at: string;
        };
        Insert: {
          agent_id: string;
          skill_id: string;
          created_at?: string;
        };
        Update: {
          agent_id?: string;
          skill_id?: string;
        };
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          target_country: string;
          currency: string;
          target_customer: string | null;
          brand_voice: string | null;
          target_margin: number;
          supplier_countries: string[];
          business_rules: Record<string, unknown>;
          approval_rules: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string | null;
          target_country?: string;
          currency?: string;
          target_customer?: string | null;
          brand_voice?: string | null;
          target_margin?: number;
          supplier_countries?: string[];
          business_rules?: Record<string, unknown>;
          approval_rules?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          target_country?: string;
          currency?: string;
          target_customer?: string | null;
          brand_voice?: string | null;
          target_margin?: number;
          supplier_countries?: string[];
          business_rules?: Record<string, unknown>;
          approval_rules?: Record<string, unknown>;
          updated_at?: string;
        };
      };
      ai_provider_credentials: {
        Row: {
          id: string;
          provider_id: string;
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
        };
        Insert: {
          id?: string;
          provider_id: string;
          name: string;
          encrypted_key: string;
          key_hint?: string | null;
          iv: string;
          auth_tag: string;
          environment?: string;
          is_active?: boolean;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          encrypted_key?: string;
          key_hint?: string | null;
          iv?: string;
          auth_tag?: string;
          environment?: string;
          is_active?: boolean;
          expires_at?: string | null;
          updated_at?: string;
        };
      };
    };
  };
}
