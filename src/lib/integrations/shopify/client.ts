// Shopify Admin API Client
// Lightweight REST client for Shopify Admin API.
// No external dependencies — uses native fetch.

export interface ShopifyConfig {
  shopDomain: string;   // e.g. "my-store.myshopify.com"
  accessToken: string;  // Admin API access token
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string | null;
  product_type: string | null;
  status: "active" | "draft" | "archived";
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  sku: string | null;
  inventory_quantity: number;
  requires_shipping: boolean;
}

export interface ShopifyImage {
  id: number;
  src: string;
  alt: string | null;
  width: number;
  height: number;
}

export interface ShopifyOrder {
  id: number;
  order_number: number;
  email: string | null;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  line_items: ShopifyLineItem[];
  created_at: string;
  updated_at: string;
}

export interface ShopifyLineItem {
  id: number;
  title: string;
  quantity: number;
  price: string;
  product_id: number | null;
  variant_id: number | null;
}

export interface ShopifyShopInfo {
  name: string;
  email: string;
  currency: string;
  plan_name: string;
}

interface ShopifyListResponse<T> {
  products?: T[];
  orders?: T[];
}

/**
 * Create a Shopify Admin API client.
 */
export function createShopifyClient(config: ShopifyConfig) {
  const baseUrl = `https://${config.shopDomain}/admin/api/2024-01`;
  const headers = {
    "X-Shopify-Access-Token": config.accessToken,
    "Content-Type": "application/json",
  };

  async function request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const res = await fetch(url.toString(), { headers });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Shopify API error ${res.status}: ${body}`);
    }

    return res.json();
  }

  return {
    /**
     * Get shop info.
     */
    async getShopInfo(): Promise<ShopifyShopInfo> {
      const data = await request<{ shop: ShopifyShopInfo }>("/shop.json");
      return data.shop;
    },

    /**
     * List products with pagination.
     */
    async listProducts(options?: { limit?: number; since_id?: number; status?: string }): Promise<ShopifyProduct[]> {
      const params: Record<string, string> = {};
      if (options?.limit) params.limit = String(options.limit);
      if (options?.since_id) params.since_id = String(options.since_id);
      if (options?.status) params.status = options.status;

      const data = await request<ShopifyListResponse<ShopifyProduct>>("/products.json", params);
      return data.products || [];
    },

    /**
     * Get a single product.
     */
    async getProduct(productId: number): Promise<ShopifyProduct> {
      const data = await request<{ product: ShopifyProduct }>(`/products/${productId}.json`);
      return data.product;
    },

    /**
     * List orders with pagination.
     */
    async listOrders(options?: { limit?: number; since_id?: number; status?: string }): Promise<ShopifyOrder[]> {
      const params: Record<string, string> = {};
      if (options?.limit) params.limit = String(options.limit);
      if (options?.since_id) params.since_id = String(options.since_id);
      if (options?.status) params.status = options.status;

      const data = await request<ShopifyListResponse<ShopifyOrder>>("/orders.json", params);
      return data.orders || [];
    },

    /**
     * Get a single order.
     */
    async getOrder(orderId: number): Promise<ShopifyOrder> {
      const data = await request<{ order: ShopifyOrder }>(`/orders/${orderId}.json`);
      return data.order;
    },

    /**
     * Fetch all products (handles pagination automatically).
     */
    async fetchAllProducts(status?: string): Promise<ShopifyProduct[]> {
      const all: ShopifyProduct[] = [];
      let sinceId: number | undefined;

      while (true) {
        const batch = await this.listProducts({ limit: 250, since_id: sinceId, status });
        if (batch.length === 0) break;
        all.push(...batch);
        sinceId = batch[batch.length - 1].id;
        if (batch.length < 250) break;
      }

      return all;
    },

    /**
     * Fetch all orders (handles pagination automatically).
     */
    async fetchAllOrders(status?: string): Promise<ShopifyOrder[]> {
      const all: ShopifyOrder[] = [];
      let sinceId: number | undefined;

      while (true) {
        const batch = await this.listOrders({ limit: 250, since_id: sinceId, status });
        if (batch.length === 0) break;
        all.push(...batch);
        sinceId = batch[batch.length - 1].id;
        if (batch.length < 250) break;
      }

      return all;
    },
  };
}

export type ShopifyClient = ReturnType<typeof createShopifyClient>;
