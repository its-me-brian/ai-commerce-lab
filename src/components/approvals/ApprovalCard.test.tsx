// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ApprovalCard, type ApprovalRecord } from "./ApprovalCard";

// Mock the formatTime utility
vi.mock("@/lib/utils/format", () => ({
  formatTime: (date: string) => new Date(date).toLocaleString(),
}));

describe("ApprovalCard", () => {
  const mockApproval: ApprovalRecord = {
    id: "approval-123",
    agent_id: "product-hunter",
    task_id: "task-456",
    action_type: "product_listing",
    action_summary: "List new product: Wireless Headphones",
    action_details: { price: 99.99 },
    risk_level: "medium",
    status: "pending",
    reviewer_notes: null,
    reviewed_at: null,
    expires_at: "2099-01-01T00:00:00Z",
    created_at: "2026-09-03T10:00:00Z",
  };

  it("renders approval card with correct status", () => {
    render(<ApprovalCard approval={mockApproval} />);
    
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Product Listing")).toBeInTheDocument();
  });

  it("renders action summary", () => {
    render(<ApprovalCard approval={mockApproval} />);
    
    expect(screen.getByText("List new product: Wireless Headphones")).toBeInTheDocument();
  });

  it("renders agent id", () => {
    render(<ApprovalCard approval={mockApproval} />);
    
    expect(screen.getByText("product-hunter")).toBeInTheDocument();
  });

  it("renders risk level", () => {
    render(<ApprovalCard approval={mockApproval} />);
    
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("renders review buttons when pending and onReview provided", () => {
    const onReview = vi.fn();
    render(<ApprovalCard approval={mockApproval} onReview={onReview} />);
    
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("does not render review buttons when not pending", () => {
    const approvedApproval = { ...mockApproval, status: "approved" as const };
    const onReview = vi.fn();
    render(<ApprovalCard approval={approvedApproval} onReview={onReview} />);
    
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Reject")).not.toBeInTheDocument();
  });

  it("calls onReview with approved when Approve clicked", () => {
    const onReview = vi.fn();
    render(<ApprovalCard approval={mockApproval} onReview={onReview} />);
    
    fireEvent.click(screen.getByText("Approve"));
    
    expect(onReview).toHaveBeenCalledWith("approval-123", "approved");
  });

  it("calls onReview with rejected when Reject clicked", () => {
    const onReview = vi.fn();
    render(<ApprovalCard approval={mockApproval} onReview={onReview} />);
    
    fireEvent.click(screen.getByText("Reject"));
    
    expect(onReview).toHaveBeenCalledWith("approval-123", "rejected");
  });

  it("renders reviewer notes when present", () => {
    const reviewedApproval: ApprovalRecord = {
      ...mockApproval,
      status: "approved",
      reviewer_notes: "Looks good, proceed with listing",
      reviewed_at: "2026-09-03T11:00:00Z",
    };
    
    render(<ApprovalCard approval={reviewedApproval} />);
    
    expect(screen.getByText("Looks good, proceed with listing")).toBeInTheDocument();
  });

  it("renders critical risk level", () => {
    const criticalApproval = { ...mockApproval, risk_level: "critical" as const };
    render(<ApprovalCard approval={criticalApproval} />);
    
    expect(screen.getByText("Critical")).toBeInTheDocument();
  });
});
