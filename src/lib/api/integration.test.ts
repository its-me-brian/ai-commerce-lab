// E2E Integration Tests — API Routes
// FASE 46: Tests the full request cycle through Next.js API routes.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "http://localhost:54321",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key"
);

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Helper to make API requests (works in Node test env)
async function api(method: string, path: string, body?: unknown) {
  const url = `${BASE_URL}${path}`;
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  return { status: res.status, data };
}

describe("API Integration — Agents", () => {
  it("GET /api/agents/config returns agent list", async () => {
    const { status, data } = await api("GET", "/api/agents/config?agentId=product-hunter");
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.agent).toBeDefined();
    expect(data.agent.id).toBe("product-hunter");
  });

  it("GET /api/agents/config with invalid id returns 404", async () => {
    const { status, data } = await api("GET", "/api/agents/config?agentId=nonexistent");
    expect(status).toBe(404);
    expect(data.error.code).toBe("AGENT_NOT_FOUND");
  });

  it("GET /api/agents/config without agentId returns 400", async () => {
    const { status, data } = await api("GET", "/api/agents/config");
    expect(status).toBe(400);
    expect(data.error.code).toBe("INVALID_INPUT");
  });
});

describe("API Integration — Providers", () => {
  it("GET /api/ai/providers returns provider list", async () => {
    const { status, data } = await api("GET", "/api/ai/providers");
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.providers)).toBe(true);
  });

  it("PATCH /api/ai/providers with invalid body returns 400", async () => {
    const { status, data } = await api("PATCH", "/api/ai/providers", { slug: "test" });
    expect(status).toBe(400);
    expect(data.success).toBe(false);
  });
});

describe("API Integration — Models", () => {
  it("GET /api/ai/models returns model list", async () => {
    const { status, data } = await api("GET", "/api/ai/models");
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.models)).toBe(true);
  });

  it("PATCH /api/ai/models without id returns 400", async () => {
    const { status, data } = await api("PATCH", "/api/ai/models", { enabled: true });
    expect(status).toBe(400);
    expect(data.success).toBe(false);
  });
});

describe("API Integration — Events", () => {
  let createdEventId: string;

  it("POST /api/events creates an event", async () => {
    const { status, data } = await api("POST", "/api/events", {
      eventType: "test.integration",
      severity: "info",
      source: "e2e-test",
      message: "Integration test event",
      metadata: { testRun: true },
    });
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.event).toBeDefined();
    expect(data.event.event_type).toBe("test.integration");
    createdEventId = data.event.id;
  });

  it("POST /api/events without required fields returns 400", async () => {
    const { status, data } = await api("POST", "/api/events", { message: "no type" });
    expect(status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("GET /api/events returns events", async () => {
    const { status, data } = await api("GET", "/api/events?limit=5");
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.events)).toBe(true);
    expect(data.total).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/events with type filter works", async () => {
    const { status, data } = await api("GET", "/api/events?type=test.integration&limit=5");
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.events.length).toBeGreaterThanOrEqual(1);
  });
});

describe("API Integration — Agent Model Routes", () => {
  it("GET /api/agents/product-hunter/model-routes returns routes", async () => {
    const { status, data } = await api("GET", "/api/agents/product-hunter/model-routes");
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.routes)).toBe(true);
  });

  it("POST /api/agents/product-hunter/model-routes without modelId returns 400", async () => {
    const { status, data } = await api("POST", "/api/agents/product-hunter/model-routes", {
      priority: 1,
    });
    expect(status).toBe(400);
    expect(data.success).toBe(false);
  });
});

describe("API Integration — Security", () => {
  it("Blocks suspicious paths (.env)", async () => {
    const res = await fetch(`${BASE_URL}/.env`);
    expect(res.status).toBe(404);
  });

  it("Blocks suspicious paths (.git)", async () => {
    const res = await fetch(`${BASE_URL}/.git/config`);
    expect(res.status).toBe(404);
  });

  it("Adds security headers to API responses", async () => {
    const res = await fetch(`${BASE_URL}/api/ai/providers`);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
});

describe("API Integration — Workspace Data", () => {
  it("GET /api/agents/product-hunter/memory returns array", async () => {
    const { status, data } = await api("GET", "/api/agents/product-hunter/memory");
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.memory)).toBe(true);
  });

  it("GET /api/agents/product-hunter/handoffs returns array", async () => {
    const { status, data } = await api("GET", "/api/agents/product-hunter/handoffs");
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.handoffs)).toBe(true);
  });

  it("GET /api/agents/product-hunter/approvals returns array", async () => {
    const { status, data } = await api("GET", "/api/agents/product-hunter/approvals");
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.approvals)).toBe(true);
  });

  it("GET /api/agents/product-hunter/events returns array", async () => {
    const { status, data } = await api("GET", "/api/agents/product-hunter/events");
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.events)).toBe(true);
  });
});
