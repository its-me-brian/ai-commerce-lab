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
          capabilities: string[];
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
          capabilities?: string[];
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
          capabilities?: string[];
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
      agent_model_routes: {
        Row: {
          id: string;
          agent_id: string;
          model_id: string;
          priority: number;
          policy: string;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          model_id: string;
          priority?: number;
          policy?: string;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          priority?: number;
          policy?: string;
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
          depends_on: string[];
          parent_task_id: string | null;
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
          depends_on?: string[];
          parent_task_id?: string | null;
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
      // --- F1-F12: Missing table types ---
      conversations: {
        Row: {
          id: string;
          agent_id: string;
          workspace_id: string | null;
          title: string | null;
          status: string;
          message_count: number;
          last_message_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          workspace_id?: string | null;
          title?: string | null;
          status?: string;
          message_count?: number;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string | null;
          status?: string;
          message_count?: number;
          last_message_at?: string | null;
          updated_at?: string;
        };
      };
      conversation_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: string;
          content: string;
          provider: string | null;
          model: string | null;
          input_tokens: number;
          output_tokens: number;
          duration_ms: number;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: string;
          content: string;
          provider?: string | null;
          model?: string | null;
          input_tokens?: number;
          output_tokens?: number;
          duration_ms?: number;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          role?: string;
          content?: string;
          provider?: string | null;
          model?: string | null;
          input_tokens?: number;
          output_tokens?: number;
          duration_ms?: number;
          metadata?: Record<string, unknown>;
        };
      };
      agent_memory: {
        Row: {
          id: string;
          agent_id: string;
          workspace_id: string | null;
          memory_type: string;
          content: string;
          source: string | null;
          confidence: number;
          metadata: Record<string, unknown>;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          workspace_id?: string | null;
          memory_type: string;
          content: string;
          source?: string | null;
          confidence?: number;
          metadata?: Record<string, unknown>;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          memory_type?: string;
          content?: string;
          source?: string | null;
          confidence?: number;
          metadata?: Record<string, unknown>;
          expires_at?: string | null;
          updated_at?: string;
        };
      };
      task_events: {
        Row: {
          id: string;
          task_id: string;
          event_type: string;
          from_status: string | null;
          to_status: string | null;
          message: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          event_type: string;
          from_status?: string | null;
          to_status?: string | null;
          message?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          event_type?: string;
          from_status?: string | null;
          to_status?: string | null;
          message?: string | null;
          metadata?: Record<string, unknown>;
        };
      };
      approvals: {
        Row: {
          id: string;
          agent_id: string;
          task_id: string | null;
          action_type: string;
          action_summary: string;
          action_details: Record<string, unknown>;
          risk_level: string;
          status: string;
          reviewer_notes: string | null;
          reviewed_at: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          task_id?: string | null;
          action_type: string;
          action_summary: string;
          action_details?: Record<string, unknown>;
          risk_level?: string;
          status?: string;
          reviewer_notes?: string | null;
          reviewed_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          action_type?: string;
          action_summary?: string;
          action_details?: Record<string, unknown>;
          risk_level?: string;
          status?: string;
          reviewer_notes?: string | null;
          reviewed_at?: string | null;
          expires_at?: string | null;
        };
      };
      app_events: {
        Row: {
          id: string;
          event_type: string;
          severity: string;
          source: string | null;
          agent_id: string | null;
          message: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          severity?: string;
          source?: string | null;
          agent_id?: string | null;
          message: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          event_type?: string;
          severity?: string;
          source?: string | null;
          agent_id?: string | null;
          message?: string;
          metadata?: Record<string, unknown>;
        };
      };
      agent_definitions: {
        Row: {
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
        };
        Insert: {
          id?: string;
          slug: string;
          version?: string;
          status?: string;
          enabled?: boolean;
          identity_name: string;
          identity_role: string;
          identity_description: string;
          mission: string;
          personality?: Record<string, unknown>;
          expertise?: string[];
          rules?: string[];
          skills?: string[];
          output_instructions?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slug?: string;
          version?: string;
          status?: string;
          enabled?: boolean;
          identity_name?: string;
          identity_role?: string;
          identity_description?: string;
          mission?: string;
          personality?: Record<string, unknown>;
          expertise?: string[];
          rules?: string[];
          skills?: string[];
          output_instructions?: Record<string, unknown> | null;
          updated_at?: string;
        };
      };
      product_catalog: {
        Row: {
          id: string;
          workspace_id: string | null;
          name: string;
          description: string | null;
          category: string | null;
          supplier_price: number | null;
          selling_price: number | null;
          currency: string;
          image_url: string | null;
          source: string | null;
          source_id: string | null;
          source_url: string | null;
          overall_score: number | null;
          decision: string | null;
          risk_level: string | null;
          status: string;
          store_content: Record<string, unknown> | null;
          seo: Record<string, unknown> | null;
          marketing_content: Record<string, unknown> | null;
          finance_analysis: Record<string, unknown> | null;
          tags: string[];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id?: string | null;
          name: string;
          description?: string | null;
          category?: string | null;
          supplier_price?: number | null;
          selling_price?: number | null;
          currency?: string;
          image_url?: string | null;
          source?: string | null;
          source_id?: string | null;
          source_url?: string | null;
          overall_score?: number | null;
          decision?: string | null;
          risk_level?: string | null;
          status?: string;
          store_content?: Record<string, unknown> | null;
          seo?: Record<string, unknown> | null;
          marketing_content?: Record<string, unknown> | null;
          finance_analysis?: Record<string, unknown> | null;
          tags?: string[];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          category?: string | null;
          supplier_price?: number | null;
          selling_price?: number | null;
          currency?: string;
          image_url?: string | null;
          source?: string | null;
          source_id?: string | null;
          source_url?: string | null;
          overall_score?: number | null;
          decision?: string | null;
          risk_level?: string | null;
          status?: string;
          store_content?: Record<string, unknown> | null;
          seo?: Record<string, unknown> | null;
          marketing_content?: Record<string, unknown> | null;
          finance_analysis?: Record<string, unknown> | null;
          tags?: string[];
          notes?: string | null;
          updated_at?: string;
        };
      };
      workflow_definitions: {
        Row: {
          id: string;
          name: string;
          description: string;
          version: string;
          enabled: boolean;
          nodes: Record<string, unknown>[];
          entry_nodes: string[] | null;
          config: Record<string, unknown>;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          version?: string;
          enabled?: boolean;
          nodes?: Record<string, unknown>[];
          entry_nodes?: string[] | null;
          config?: Record<string, unknown>;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string;
          version?: string;
          enabled?: boolean;
          nodes?: Record<string, unknown>[];
          entry_nodes?: string[] | null;
          config?: Record<string, unknown>;
          tags?: string[];
          updated_at?: string;
        };
      };
      knowledge_documents: {
        Row: {
          id: string;
          workspace_id: string;
          title: string;
          content: string;
          source_type: string;
          source_url: string | null;
          category: string;
          tags: string[];
          embedding: number[] | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          title: string;
          content: string;
          source_type?: string;
          source_url?: string | null;
          category?: string;
          tags?: string[];
          embedding?: number[] | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          content?: string;
          source_type?: string;
          source_url?: string | null;
          category?: string;
          tags?: string[];
          embedding?: number[] | null;
          metadata?: Record<string, unknown>;
          updated_at?: string;
        };
      };
    };
  };
}
