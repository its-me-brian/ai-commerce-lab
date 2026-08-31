// Supabase Client
// Server-side Supabase client for database operations.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client with service role key (full access)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Database types (will be generated from Supabase later)
export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          name: string;
          description: string;
          enabled: boolean;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description: string;
          enabled?: boolean;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          enabled?: boolean;
          status?: string;
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
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
          error: string | null;
        };
        Insert: {
          id: string;
          agent_id: string;
          status: string;
          task_type: string;
          input: Record<string, unknown>;
          output?: Record<string, unknown> | null;
          priority?: number;
          created_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          error?: string | null;
        };
        Update: {
          status?: string;
          output?: Record<string, unknown> | null;
          started_at?: string | null;
          completed_at?: string | null;
          error?: string | null;
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
          duration_ms: number;
          status: string;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          task_id: string;
          agent_id: string;
          provider: string;
          model: string;
          input_tokens: number;
          output_tokens: number;
          duration_ms: number;
          status: string;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          status?: string;
          error?: string | null;
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
          id: string;
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
      ai_providers: {
        Row: {
          id: string;
          name: string;
          slug: string;
          enabled: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          slug: string;
          enabled?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
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
          context_window: number;
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
      decisions: {
        Row: {
          id: string;
          agent_id: string;
          task_id: string;
          decision_type: string;
          input_summary: string;
          output_summary: string;
          confidence: number | null;
          reasoning: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          agent_id: string;
          task_id: string;
          decision_type: string;
          input_summary: string;
          output_summary: string;
          confidence?: number | null;
          reasoning?: string | null;
          created_at?: string;
        };
        Update: {
          decision_type?: string;
          input_summary?: string;
          output_summary?: string;
          confidence?: number | null;
          reasoning?: string | null;
        };
      };
      products: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          supplier_price: number;
          selling_price: number | null;
          shipping_cost: number;
          margin: number | null;
          score: number | null;
          status: string;
          supplier_id: string | null;
          supplier_url: string | null;
          images: string[] | null;
          tags: string[] | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string | null;
          supplier_price: number;
          selling_price?: number | null;
          shipping_cost?: number;
          margin?: number | null;
          score?: number | null;
          status?: string;
          supplier_id?: string | null;
          supplier_url?: string | null;
          images?: string[] | null;
          tags?: string[] | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          supplier_price?: number;
          selling_price?: number | null;
          shipping_cost?: number;
          margin?: number | null;
          score?: number | null;
          status?: string;
          supplier_id?: string | null;
          supplier_url?: string | null;
          images?: string[] | null;
          tags?: string[] | null;
          metadata?: Record<string, unknown> | null;
          updated_at?: string;
        };
      };
      product_research: {
        Row: {
          id: string;
          product_id: string;
          agent_id: string;
          research_type: string;
          data: Record<string, unknown>;
          score: number | null;
          recommendation: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          product_id: string;
          agent_id: string;
          research_type: string;
          data: Record<string, unknown>;
          score?: number | null;
          recommendation?: string | null;
          created_at?: string;
        };
        Update: {
          research_type?: string;
          data?: Record<string, unknown>;
          score?: number | null;
          recommendation?: string | null;
        };
      };
    };
  };
}
