// Workspace Service Tests

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkspaceService } from "./service";
import type { Workspace } from "./types";

// Mock Supabase
vi.mock("../database/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

const mockWorkspace: Workspace = {
  id: "ws-test",
  name: "Test Store",
  description: "Test workspace",
  target_country: "ES",
  currency: "EUR",
  target_customer: "European consumers",
  brand_voice: "Professional",
  target_margin: 3.0,
  supplier_countries: ["IT", "ES"],
  business_rules: {},
  approval_rules: {},
  created_at: "2026-08-31T00:00:00Z",
  updated_at: "2026-08-31T00:00:00Z",
};

describe("WorkspaceService", () => {
  let service: WorkspaceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkspaceService();
  });

  it("should create a workspace service instance", () => {
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(WorkspaceService);
  });

  it("should have get method", () => {
    expect(typeof service.get).toBe("function");
  });

  it("should have list method", () => {
    expect(typeof service.list).toBe("function");
  });

  it("should have create method", () => {
    expect(typeof service.create).toBe("function");
  });

  it("should have update method", () => {
    expect(typeof service.update).toBe("function");
  });

  it("should have buildCompanyContext method", () => {
    expect(typeof service.buildCompanyContext).toBe("function");
  });

  it("should have formatContextForPrompt method", () => {
    expect(typeof service.formatContextForPrompt).toBe("function");
  });

  describe("formatContextForPrompt", () => {
    it("should format workspace context as prompt section", () => {
      const context = {
        workspace: mockWorkspace,
        active_products: 5,
        pending_tasks: 2,
        recent_decisions: [],
      };

      const prompt = service.formatContextForPrompt(context);

      expect(prompt).toContain("## Company Context");
      expect(prompt).toContain("Test Store");
      expect(prompt).toContain("ES");
      expect(prompt).toContain("EUR");
      expect(prompt).toContain("3x");
      expect(prompt).toContain("IT, ES");
    });

    it("should handle missing optional fields", () => {
      const context = {
        workspace: {
          ...mockWorkspace,
          target_customer: null,
          brand_voice: null,
          business_rules: {},
          approval_rules: {},
        },
        active_products: 0,
        pending_tasks: 0,
        recent_decisions: [],
      };

      const prompt = service.formatContextForPrompt(context);

      expect(prompt).toContain("Not defined");
    });
  });
});
