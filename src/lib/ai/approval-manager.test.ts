// Approval Manager Tests
// FASE 29: Human-in-the-loop approval workflows.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApprovalManager, type Approval }from "./approval-manager";

// Proxy-based Supabase mock
function createMockQuery(returnData: unknown = null, returnError: unknown = null) {
  const result = { data: returnData, error: returnError };
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

vi.mock("../database/supabase", () => ({
  supabase: {
    from: vi.fn(() => createMockQuery()),
  },
}));

describe("ApprovalManager", () => {
  let manager: ApprovalManager;

  const mockApproval: Approval = {
    id: "ap-1",
    agent_id: "product-hunter",
    task_id: "task-1",
    action_type: "product_listing",
    action_summary: "List new product: Wireless Mouse",
    action_details: { price: 29.99, supplier: "TechCo" },
    risk_level: "medium",
    status: "pending",
    reviewer_notes: null,
    reviewed_at: null,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ApprovalManager();
  });

  describe("createApproval", () => {
    it("should create a pending approval", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockApproval)
      );

      const approval = await manager.createApproval({
        agent_id: "product-hunter",
        task_id: "task-1",
        action_type: "product_listing",
        action_summary: "List new product: Wireless Mouse",
        action_details: { price: 29.99 },
      }, "test-ws");

      expect(approval.id).toBe("ap-1");
      expect(approval.status).toBe("pending");
      expect(approval.risk_level).toBe("medium");
    });

    it("should set custom expiry", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery({ ...mockApproval, expires_at: new Date(Date.now() + 3600000).toISOString() })
      );

      const approval = await manager.createApproval({
        agent_id: "product-hunter",
        action_type: "price_change",
        action_summary: "Change price",
        expires_in_ms: 3600000, // 1 hour
      }, "test-ws");

      expect(approval.expires_at).toBeDefined();
    });

    it("should default to medium risk", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockApproval)
      );

      const approval = await manager.createApproval({
        agent_id: "a",
        action_type: "custom",
        action_summary: "test",
      }, "test-ws");

      expect(approval.risk_level).toBe("medium");
    });
  });

  describe("reviewApproval", () => {
    it("should approve an approval", async () => {
      const { supabase } = await import("../database/supabase");
      const mockFrom = vi.fn()
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { status: "pending" }, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { ...mockApproval, status: "approved", reviewed_at: new Date().toISOString() },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        });
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(mockFrom);

      const result = await manager.reviewApproval({
        approval_id: "ap-1",
        decision: "approved",
        notes: "Looks good",
      }, "ws-test");

      expect(result.status).toBe("approved");
    });

    it("should reject an approval", async () => {
      const { supabase } = await import("../database/supabase");
      const mockFrom = vi.fn()
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { status: "pending" }, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { ...mockApproval, status: "rejected", reviewed_at: new Date().toISOString() },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        });
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(mockFrom);

      const result = await manager.reviewApproval({
        approval_id: "ap-1",
        decision: "rejected",
        notes: "Price too low",
      }, "ws-test");

      expect(result.status).toBe("rejected");
    });

    it("should throw if approval not found", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(null, { message: "not found" })
      );

      await expect(
        manager.reviewApproval({ approval_id: "nonexistent", decision: "approved" }, "ws-test")
      ).rejects.toThrow("Approval not found");
    });

    it("should throw if approval already reviewed", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery({ status: "approved" })
      );

      await expect(
        manager.reviewApproval({ approval_id: "ap-1", decision: "approved" }, "ws-test")
      ).rejects.toThrow("Approval already approved");
    });
  });

  describe("isApproved", () => {
    it("should return true for approved", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery({ status: "approved" })
      );

      expect(await manager.isApproved("ap-1", "ws-test")).toBe(true);
    });

    it("should return false for pending", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery({ status: "pending" })
      );

      expect(await manager.isApproved("ap-1", "ws-test")).toBe(false);
    });
  });

  describe("expireApproval", () => {
    it("should expire a pending approval", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery({ ...mockApproval, status: "expired" })
      );

      const result = await manager.expireApproval("ap-1", "ws-test");
      expect(result?.status).toBe("expired");
    });

    it("should return null for non-pending approval", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(null) // No rows matched (status != pending)
      );

      const result = await manager.expireApproval("ap-1", "ws-test");
      expect(result).toBeNull();
    });
  });

  describe("cancelApproval", () => {
    it("should cancel a pending approval", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery({ ...mockApproval, status: "cancelled" })
      );

      const result = await manager.cancelApproval("ap-1", "ws-test");
      expect(result?.status).toBe("cancelled");
    });
  });

  describe("getPendingApprovals", () => {
    it("should return pending approvals", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery([mockApproval])
      );

      const approvals = await manager.getPendingApprovals("ws-test");
      expect(approvals.length).toBe(1);
      expect(approvals[0].status).toBe("pending");
    });

    it("should return empty array on error", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(null, { message: "fail" })
      );

      const approvals = await manager.getPendingApprovals("ws-test");
      expect(approvals).toEqual([]);
    });
  });

  describe("getApprovalsByAgent", () => {
    it("should return approvals for an agent", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery([mockApproval])
      );

      const approvals = await manager.getApprovalsByAgent("product-hunter", "ws-test");
      expect(approvals.length).toBe(1);
    });
  });

  describe("getApproval", () => {
    it("should return approval by ID", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(mockApproval)
      );

      const approval = await manager.getApproval("ap-1", "ws-test");
      expect(approval?.id).toBe("ap-1");
    });

    it("should return null if not found", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery(null, { message: "not found" })
      );

      const approval = await manager.getApproval("nonexistent", "ws-test");
      expect(approval).toBeNull();
    });
  });

  describe("getPendingCounts", () => {
    it("should count pending by risk level", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery([
          { risk_level: "high" },
          { risk_level: "high" },
          { risk_level: "critical" },
          { risk_level: "low" },
        ])
      );

      const counts = await manager.getPendingCounts("ws-test");
      expect(counts.high).toBe(2);
      expect(counts.critical).toBe(1);
      expect(counts.low).toBe(1);
      expect(counts.medium).toBe(0);
    });
  });

  describe("expireOverdue", () => {
    it("should return 0 if no overdue", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery([])
      );

      const count = await manager.expireOverdue("ws-test");
      expect(count).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should calculate stats", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery([
          { ...mockApproval, status: "pending" },
          { ...mockApproval, status: "approved", reviewed_at: new Date().toISOString() },
          { ...mockApproval, status: "rejected", reviewed_at: new Date().toISOString() },
        ])
      );

      const stats = await manager.getStats("ws-test");
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
    });

    it("should return zero stats for empty", async () => {
      const { supabase } = await import("../database/supabase");
      (supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() =>
        createMockQuery([])
      );

      const stats = await manager.getStats("ws-test");
      expect(stats.total).toBe(0);
    });
  });
});
