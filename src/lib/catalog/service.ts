// Product Catalog Service
// CRUD operations for the product catalog.
// Stores products discovered by agents for browsing and management.

import { supabase } from "../database/supabase";

export interface CatalogProduct {
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
}

export type CatalogStatus = "discovered" | "evaluating" | "approved" | "listed" | "rejected" | "archived";

export interface CatalogCreateInput {
  name: string;
  description?: string;
  category?: string;
  supplier_price?: number;
  selling_price?: number;
  currency?: string;
  image_url?: string;
  source?: string;
  source_id?: string;
  source_url?: string;
  overall_score?: number;
  decision?: string;
  risk_level?: string;
  status?: CatalogStatus;
  tags?: string[];
  notes?: string;
  workspace_id?: string;
}

export interface CatalogUpdateInput {
  name?: string;
  description?: string;
  category?: string;
  supplier_price?: number;
  selling_price?: number;
  image_url?: string;
  overall_score?: number;
  decision?: string;
  risk_level?: string;
  status?: CatalogStatus;
  store_content?: Record<string, unknown>;
  seo?: Record<string, unknown>;
  marketing_content?: Record<string, unknown>;
  finance_analysis?: Record<string, unknown>;
  tags?: string[];
  notes?: string;
}

export class CatalogService {
  /**
   * List all catalog products, optionally filtered by status.
   */
  async list(options?: { status?: CatalogStatus; limit?: number; offset?: number }): Promise<CatalogProduct[]> {
    let query = supabase
      .from("product_catalog")
      .select("*")
      .order("created_at", { ascending: false });

    if (options?.status) {
      query = query.eq("status", options.status);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as CatalogProduct[];
  }

  /**
   * Get a single catalog product by ID.
   */
  async getById(id: string): Promise<CatalogProduct | null> {
    const { data, error } = await supabase
      .from("product_catalog")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as CatalogProduct;
  }

  /**
   * Add a product to the catalog.
   */
  async create(input: CatalogCreateInput): Promise<CatalogProduct | null> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("product_catalog")
      .insert({
        ...input,
        tags: input.tags || [],
        status: input.status || "discovered",
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error || !data) return null;
    return data as CatalogProduct;
  }

  /**
   * Update a catalog product.
   */
  async update(id: string, input: CatalogUpdateInput): Promise<CatalogProduct | null> {
    const { data, error } = await supabase
      .from("product_catalog")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return null;
    return data as CatalogProduct;
  }

  /**
   * Change product status in the pipeline.
   */
  async setStatus(id: string, status: CatalogStatus): Promise<boolean> {
    const { error } = await supabase
      .from("product_catalog")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    return !error;
  }

  /**
   * Delete a catalog product.
   */
  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("product_catalog")
      .delete()
      .eq("id", id);

    return !error;
  }

  /**
   * Get counts by status for dashboard KPIs.
   */
  async getCountsByStatus(): Promise<Record<CatalogStatus, number>> {
    const { data, error } = await supabase
      .from("product_catalog")
      .select("status");

    const counts: Record<CatalogStatus, number> = {
      discovered: 0,
      evaluating: 0,
      approved: 0,
      listed: 0,
      rejected: 0,
      archived: 0,
    };

    if (error || !data) return counts;

    for (const row of data as Array<{ status: string }>) {
      if (row.status in counts) {
        counts[row.status as CatalogStatus]++;
      }
    }

    return counts;
  }

  /**
   * Search products by name or category.
   */
  async search(query: string): Promise<CatalogProduct[]> {
    const { data, error } = await supabase
      .from("product_catalog")
      .select("*")
      .or(`name.ilike.%${query}%,category.ilike.%${query}%`)
      .order("overall_score", { ascending: false })
      .limit(20);

    if (error || !data) return [];
    return data as CatalogProduct[];
  }
}

// Singleton
let instance: CatalogService | null = null;

export function getCatalogService(): CatalogService {
  if (!instance) {
    instance = new CatalogService();
  }
  return instance;
}
